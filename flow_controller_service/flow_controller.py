# flow_controller_service/flow_controller.py
import flask
from flask import Flask, request, jsonify
import logging
import os
import mysql.connector
import json
import re
import requests 
import socket

app = Flask(__name__)

# --- Configuração de Logging ---
log_formatter = logging.Formatter('%(asctime)s - [%(levelname)s] - (%(module)s:%(funcName)s:%(lineno)d) - %(message)s')
logger = logging.getLogger(__name__)
logger.setLevel(os.environ.get('LOG_LEVEL', 'INFO').upper())
console_handler = logging.StreamHandler()
console_handler.setFormatter(log_formatter)

if not logger.hasHandlers():
    logger.addHandler(console_handler)
logger.info("Logging configurado para Flow Controller (MySQL).")

# --- DEBUG DE DNS ---
V50MCP_AI_QUERY_API_URL_ENV = os.environ.get("V50MCP_AI_QUERY_API_URL", "")
V50MCP_DOMAIN_TO_CHECK = ""
if V50MCP_AI_QUERY_API_URL_ENV.startswith("https://"):
    V50MCP_DOMAIN_TO_CHECK = V50MCP_AI_QUERY_API_URL_ENV.replace("https://", "").split("/")[0]
elif V50MCP_AI_QUERY_API_URL_ENV.startswith("http://"):
    V50MCP_DOMAIN_TO_CHECK = V50MCP_AI_QUERY_API_URL_ENV.replace("http://", "").split("/")[0]

if V50MCP_DOMAIN_TO_CHECK:
    try:
        logger.info(f"DEBUG DNS: Tentando resolver o IP para '{V50MCP_DOMAIN_TO_CHECK}'...")
        ip_address = socket.gethostbyname(V50MCP_DOMAIN_TO_CHECK)
        logger.info(f"DEBUG DNS: '{V50MCP_DOMAIN_TO_CHECK}' resolvido para IP: {ip_address}")
    except socket.gaierror as e:
        logger.error(f"DEBUG DNS: FALHA ao resolver '{V50MCP_DOMAIN_TO_CHECK}'. Erro: {e}")
    except Exception as e_gen:
        logger.error(f"DEBUG DNS: Erro inesperado durante a tentativa de resolução de DNS para '{V50MCP_DOMAIN_TO_CHECK}': {e_gen}")
else:
    logger.warning("DEBUG DNS: V50MCP_AI_QUERY_API_URL não definida ou formato inválido, não é possível checar DNS do host da API de IA.")
# --- FIM DO DEBUG DE DNS ---

user_states = {}
current_flow_definition = {
    "id": None, "name": None, "nodes": {}, "edges": [], "start_node_id": None
}

def get_mysql_connection():
    try:
        db_host = os.environ.get('DB_HOST_PYTHON')
        db_user = os.environ.get('DB_USER_PYTHON')
        db_password = os.environ.get('DB_PASSWORD_PYTHON')
        db_name = os.environ.get('DB_NAME_PYTHON')
        db_port_str = os.environ.get('DB_PORT_PYTHON')
        if not all([db_host, db_user, db_password, db_name, db_port_str]):
            missing_vars = [var for var in ['DB_HOST_PYTHON', 'DB_USER_PYTHON', 'DB_PASSWORD_PYTHON', 'DB_NAME_PYTHON', 'DB_PORT_PYTHON'] if not os.environ.get(var)]
            logger.critical(f"Variáveis de ambiente do MySQL para Python faltando: {', '.join(missing_vars)}")
            raise ConnectionError(f"Variáveis de ambiente do MySQL para Python faltando: {', '.join(missing_vars)}")
        db_port = int(db_port_str)
        conn = mysql.connector.connect(
            host=db_host, user=db_user, password=db_password,
            database=db_name, port=db_port,
            charset='utf8mb4', collation='utf8mb4_unicode_ci',
            connection_timeout=30
        )
        logger.debug(f"Conexão com MySQL DB ({db_host}:{db_port}) estabelecida.")
        return conn
    except Exception as e:
        logger.error(f"Erro ao obter conexão MySQL: {e}", exc_info=True)
        raise

def load_flow_from_db():
    global current_flow_definition
    logger.info("Tentando carregar fluxo ativo do banco de dados MySQL.")
    conn = None; cursor = None; success_flag = False
    try:
        conn = get_mysql_connection(); cursor = conn.cursor(dictionary=True)
        query = "SELECT id, name, elements FROM flows WHERE status = 'active' LIMIT 1"; cursor.execute(query); row = cursor.fetchone()
        if row:
            flow_id = row['id']; flow_name = row['name']; elements_data = row['elements']
            logger.info(f"Fluxo ativo encontrado no MySQL: ID={flow_id}, Nome='{flow_name}'")
            if isinstance(elements_data, (bytes, bytearray)): elements_data = elements_data.decode('utf-8')
            if isinstance(elements_data, str): elements = json.loads(elements_data)
            elif isinstance(elements_data, dict): elements = elements_data
            else: logger.error(f"Formato de 'elements' inesperado para o fluxo ID {flow_id}."); elements = {"nodes": [], "edges": []}
            nodes_list = elements.get('nodes', []); edges_list = elements.get('edges', [])
            if not isinstance(nodes_list, list) or not isinstance(edges_list, list): logger.warning(f"Formato de 'nodes' ou 'edges' inválido no fluxo {flow_id}."); nodes_list, edges_list = [], []
            nodes_dict = {node['id']: node for node in nodes_list if isinstance(node, dict) and 'id' in node}
            start_node = None
            if nodes_list:
                explicit_start_node = next((n for n in nodes_list if isinstance(n,dict) and n.get("type")=="startNode"),None)
                if explicit_start_node: start_node = explicit_start_node; logger.info(f"Nó inicial explícito (startNode): ID={start_node.get('id')}")
                else:
                    all_target_ids = {e.get('target') for e in edges_list if isinstance(e,dict) and e.get('target')}
                    possible_starts = [n for nid,n in nodes_dict.items() if nid not in all_target_ids]
                    if possible_starts: start_node = possible_starts[0]; logger.info(f"Nó inicial inferido (sem incoming edges): ID={start_node.get('id')}")
                    elif nodes_list and isinstance(nodes_list[0],dict): start_node = nodes_list[0]; logger.warning(f"Nenhum nó inicial claro. Usando primeiro nó da lista: ID={start_node.get('id') if start_node else 'N/A'}")
                    else: logger.error("Lista de nós vazia ou mal formatada. Não foi possível determinar o nó inicial.")
            else: logger.error("A lista de 'nodes' está vazia no fluxo.")
            current_flow_definition = {"id": flow_id, "name": flow_name, "nodes": nodes_dict, "edges": edges_list, "start_node_id": start_node['id'] if start_node and 'id' in start_node else None}
            if current_flow_definition['start_node_id']:
                success_flag = True; logger.info(f"Fluxo MySQL '{flow_name}' (ID: {flow_id}) carregado. Nó inicial: {current_flow_definition['start_node_id']}")
                initial_node_details = get_node_by_id(current_flow_definition['start_node_id'])
                if initial_node_details: logger.info(f"Detalhes Nó Inicial ({current_flow_definition['start_node_id']}): Tipo='{initial_node_details.get('type')}', Data='{json.dumps(initial_node_details.get('data', {}))[:100]}...'")
                else: logger.warning(f"Nó inicial ID '{current_flow_definition['start_node_id']}' não encontrado nos nós."); success_flag = False
            else: logger.error(f"NÓ INICIAL NÃO DETERMINADO para fluxo '{flow_name}'.")
        else: logger.warning("Nenhum fluxo 'active' no DB."); current_flow_definition = {"id": None, "name": None, "nodes": {}, "edges": [], "start_node_id": None}
    except json.JSONDecodeError as je: logger.error(f"Erro JSON 'elements': {je}", exc_info=True)
    except Exception as e: logger.error(f"Erro ao carregar fluxo: {e}", exc_info=True)
    finally:
        if cursor: cursor.close();
        if conn and conn.is_connected(): conn.close(); logger.debug("Conexão MySQL fechada (load_flow).")
    if not success_flag and not current_flow_definition.get("id"): current_flow_definition = {"id": None, "name": None, "nodes": {}, "edges": [], "start_node_id": None}
    return success_flag

def get_node_by_id(node_id: str | None):
    if not node_id: return None
    return current_flow_definition["nodes"].get(node_id)

def process_text_variables(text: str | None, user_vars: dict) -> str | None:
    if text is None: return None
    processed_text = str(text)
    for _ in range(5): 
        new_text = re.sub(r"\{\{(.+?)\}\}", lambda m: str(user_vars.get(m.group(1).strip(),f"{{{{{m.group(1).strip()}}}}}")) ,processed_text)
        if new_text == processed_text: break
        processed_text = new_text
    return processed_text

def get_response_payload_for_node(node_id: str, user_vars: dict) -> dict | None:
    node = get_node_by_id(node_id)
    if not node: logger.warning(f"Nó ID '{node_id}' não encontrado em get_response_payload_for_node."); return None
    node_type = node.get("type"); node_data = node.get("data", {})
    logger.debug(f"Gerando payload para nó ID '{node_id}', tipo '{node_type}'.")
    payload = None
    try:
        if node_type == "textMessage":
            text = process_text_variables(node_data.get("text"), user_vars)
            if text is not None: payload = {"type": "text", "text": text} # Envia mesmo se for string vazia, se processado
            else: logger.warning(f"Nó textMessage '{node_id}' sem texto ou resultou em None.")
        elif node_type == "waitInput": # Este nó envia um prompt
            message_prompt = process_text_variables(node_data.get("message"), user_vars)
            if message_prompt is not None: payload = {"type": "text", "text": message_prompt}
            else: logger.warning(f"Nó waitInput '{node_id}' sem prompt ('data.message') ou resultou em None.")
        # Adicione aqui a lógica para gerar payloads para SEUS outros tipos de nós que enviam mensagens
        # (imageMessage, buttonMessage, listMessage, endFlow com texto, etc.)
        # Exemplo para endFlow com texto:
        elif node_type == "endFlow":
            text = process_text_variables(node_data.get("text"), user_vars) # Assumindo que 'text' é o campo para a mensagem final
            if text is not None: payload = {"type": "text", "text": text}
            # Se endFlow não tiver texto, não gera payload, o que é ok.
    except Exception as e:
        logger.error(f"Erro em get_response_payload_for_node para nó {node_id} (tipo: {node_type}): {e}", exc_info=True)
        return None
    if payload: logger.info(f"Payload gerado para '{node_id}': {str(payload)[:100]}...")
    else: logger.debug(f"Nenhum payload de resposta gerado para nó '{node_id}' (tipo: {node_type}).")
    return payload

def evaluate_condition(condition_node_data: dict, user_message_trigger: str | None, variables: dict) -> bool:
    var_name_template = condition_node_data.get('variableName'); comparison_type = condition_node_data.get('comparison'); value_to_compare_template = condition_node_data.get('value')
    if not var_name_template or not comparison_type: logger.warning(f"Condição malformada: {condition_node_data}"); return False
    processed_var_name = process_text_variables(var_name_template, variables); value_from_user_vars = variables.get(processed_var_name)
    actual_value = process_text_variables(str(value_from_user_vars) if value_from_user_vars is not None else None, variables)
    value_to_compare = process_text_variables(str(value_to_compare_template) if value_to_compare_template is not None else None, variables)
    logger.debug(f"Avaliando Condição: Var='{processed_var_name}' (Efetivo='{actual_value}'), Comp='{comparison_type}', ValParaComparar='{value_to_compare}'")
    if comparison_type == 'isSet': return actual_value is not None and actual_value != "" and actual_value.lower() != 'none'
    if comparison_type == 'isNotSet': return actual_value is None or actual_value == "" or actual_value.lower() == 'none'
    if actual_value is None: return False # Outras comparações geralmente falham se a variável não estiver setada
    actual_value_str = str(actual_value).lower(); value_to_compare_str = str(value_to_compare).lower() if value_to_compare is not None else None
    if comparison_type == 'equals': return actual_value_str == value_to_compare_str
    if comparison_type == 'notEquals': return actual_value_str != value_to_compare_str
    if comparison_type == 'contains': return value_to_compare_str is not None and value_to_compare_str in actual_value_str
    if comparison_type == 'startsWith': return value_to_compare_str is not None and actual_value_str.startswith(value_to_compare_str)
    if comparison_type == 'endsWith': return value_to_compare_str is not None and actual_value_str.endswith(value_to_compare_str)
    if comparison_type == 'regex':
        if value_to_compare is None: return False
        try:
            pattern = str(value_to_compare_template); flags = 0
            if '[i]' in pattern: pattern = pattern.replace('[i]', ''); flags = re.IGNORECASE
            return bool(re.search(pattern, str(value_from_user_vars if value_from_user_vars is not None else ""), flags))
        except re.error as e: logger.error(f"Regex inválido: '{value_to_compare_template}', erro: {e}"); return False
    numeric_comparisons = ['greaterThan', 'lessThan', 'greaterOrEquals', 'lessOrEquals']
    if comparison_type in numeric_comparisons:
        if value_to_compare is None: return False
        try:
            num_actual = float(actual_value); num_compare = float(value_to_compare)
            if comparison_type == 'greaterThan': return num_actual > num_compare
            if comparison_type == 'lessThan': return num_actual < num_compare
            if comparison_type == 'greaterOrEquals': return num_actual >= num_compare
            if comparison_type == 'lessOrEquals': return num_actual <= num_compare
        except (ValueError, TypeError): logger.warning(f"Conversão para float falhou para '{actual_value}' ou '{value_to_compare}'"); return False
    logger.warning(f"Tipo de comparação desconhecido: {comparison_type}"); return False

def determine_next_node_id_from_edges(current_node_id: str, trigger_value: str | None, user_vars: dict, node_type_of_source: str | None) -> str | None:
    outgoing_edges = [edge for edge in current_flow_definition.get("edges", []) if isinstance(edge, dict) and edge.get('source') == current_node_id]
    logger.debug(f"Determinando próximo nó de {current_node_id} (Tipo:{node_type_of_source}). Edges:{len(outgoing_edges)}. Trigger:'{trigger_value}'")
    if trigger_value and trigger_value not in ["_internal_start_flow_", "_internal_transition_", "_internal_error_"]:
        for edge in outgoing_edges:
            if edge.get('sourceHandle') == trigger_value: logger.info(f"Edge por sourceHandle '{trigger_value}'. Próximo nó: {edge.get('target')}"); return edge.get('target')
    if node_type_of_source == "waitInput" and trigger_value not in [None, "_internal_start_flow_", "_internal_transition_"]:
        edge = next((e for e in outgoing_edges if e.get('sourceHandle') == 'source-received'), None)
        if edge: logger.info(f"WaitInput: Input '{trigger_value}'. Edge 'source-received'. Próximo nó: {edge.get('target')}"); return edge.get('target')
    if trigger_value == "_internal_error_": # Para nós que podem ter uma saída de erro específica
        error_edge = next((edge for edge in outgoing_edges if edge.get('sourceHandle') == 'source-error'), None)
        if error_edge: logger.info(f"Nó {current_node_id} em erro. Usando edge 'source-error'. Próximo nó: {error_edge.get('target')}"); return error_edge.get('target')
    # Fallback para edge padrão (sem sourceHandle ou com handles genéricos)
    default_edges = [edge for edge in outgoing_edges if not edge.get('sourceHandle') or edge.get('sourceHandle') in ['source', 'source-bottom', 'source-default', 'source-success']]
    if default_edges:
        if len(default_edges) > 1: logger.warning(f"Múltiplas edges padrão para {current_node_id} (handles: {[e.get('sourceHandle') for e in default_edges]}). Usando a primeira.")
        logger.info(f"Usando edge padrão de {current_node_id} (handle: {default_edges[0].get('sourceHandle')}). Próximo nó: {default_edges[0].get('target')}"); return default_edges[0].get('target')
    logger.warning(f"Nenhuma edge aplicável de {current_node_id} (Tipo:{node_type_of_source}) com trigger '{trigger_value}'.")
    return None

@app.route('/process_message', methods=['POST'])
def process_message_route():
    data = request.json
    if not data: logger.warning("API /process_message: Request body vazio."); return jsonify({"error": "Request body is missing"}), 400
    sender_id = data.get('sender_id'); message_content_or_interaction_id = data.get('message', '') 
    logger.info(f"API /process_message: Recebido de sender_id='{sender_id}', message/interaction='{str(message_content_or_interaction_id)[:100]}'")
    if not sender_id: return jsonify({"error": "sender_id é obrigatório"}), 400
    if not current_flow_definition.get("id") or not current_flow_definition.get("start_node_id"):
         if not load_flow_from_db() or not current_flow_definition.get("start_node_id"):
            logger.error("API /process_message: Falha crítica ao recarregar fluxo ou fluxo inválido.")
            return jsonify({"response_payload": {"type":"text", "text": "Desculpe, o sistema está temporariamente indisponível."}}), 200
         logger.info("Fluxo recarregado com sucesso durante o processamento da mensagem.")
    user_session = user_states.get(sender_id)
    is_new_session = False
    if not user_session:
        is_new_session = True; user_session = {"current_node_id": current_flow_definition["start_node_id"], "variables": {}, "history": []}
        user_states[sender_id] = user_session; current_message_trigger = "_internal_start_flow_"
        logger.info(f"Nova sessão para {sender_id}. Nó inicial: {user_session['current_node_id']}.")
    else: current_message_trigger = message_content_or_interaction_id; logger.info(f"Sessão existente para {sender_id}. Nó atual: {user_session['current_node_id']}. Trigger: '{current_message_trigger}'")
    
    active_node_id = user_session["current_node_id"]; user_vars = user_session["variables"]
    if not is_new_session: user_session["history"].append({"node_before_input": active_node_id, "trigger_received": current_message_trigger})
    
    response_payload_to_send = None; next_node_id_for_session_update = active_node_id 
    hop_count = 0; max_hops = 15

    while hop_count < max_hops:
        hop_count += 1; current_node_object = get_node_by_id(active_node_id)
        if not current_node_object:
            logger.error(f"Loop {hop_count}: Nó ID '{active_node_id}' não encontrado! Resetando sessão.");
            if sender_id in user_states: del user_states[sender_id];
            response_payload_to_send = {"type":"text", "text":"Erro interno no fluxo."}; next_node_id_for_session_update=None; break
            
        node_type = current_node_object.get("type"); node_data = current_node_object.get("data", {})
        logger.info(f"Loop {hop_count}/{max_hops}: Processando nó ID='{active_node_id}' (Tipo='{node_type}') Trigger='{current_message_trigger}'")

        if response_payload_to_send is None and \
           (current_message_trigger == "_internal_start_flow_" or \
            (node_type in ["waitInput", "buttonMessage", "listMessage", "textMessage", "imageMessage", "audioMessage", "videoMessage", "fileMessage", "locationMessage", "endFlow"] and hop_count == 1) or \
            (node_type in ["waitInput", "buttonMessage", "listMessage"] and current_message_trigger == "_internal_transition_")):
            response_payload_to_send = get_response_payload_for_node(active_node_id, user_vars)
        
        potential_next_node_id_after_processing = None
        
        if node_type == "waitInput":
            if current_message_trigger not in ["_internal_start_flow_", "_internal_transition_"]:
                variable_to_save = node_data.get("variableName", "lastInput"); user_vars[variable_to_save] = current_message_trigger
                logger.info(f"WaitInput: Input '{str(current_message_trigger)[:50]}' salvo em '{variable_to_save}'.")
                potential_next_node_id_after_processing = determine_next_node_id_from_edges(active_node_id, current_message_trigger, user_vars, node_type)
                current_message_trigger = "_internal_transition_"
            else: next_node_id_for_session_update = active_node_id; break
        
        elif node_type == "setVariable":
            var_name_template = node_data.get("variableName"); value_template = node_data.get("value")
            if var_name_template:
                var_name = process_text_variables(var_name_template, user_vars).strip()
                processed_value = process_text_variables(str(value_template if value_template is not None else ''), user_vars)
                user_vars[var_name] = processed_value; logger.info(f"SetVariable: '{var_name}' = '{str(processed_value)[:50]}'.")
            potential_next_node_id_after_processing = determine_next_node_id_from_edges(active_node_id, "_internal_transition_", user_vars, node_type)
            current_message_trigger = "_internal_transition_"

        elif node_type == "gptQuery":
            logger.debug(f"[GPTQuery Node Debug] Raw node_data: {json.dumps(node_data)}")
            prompt_template = node_data.get("prompt")
            system_message_template = node_data.get("systemMessage")
            api_key_variable_name_from_node = node_data.get("apiKeyVariable")
            variable_to_save_response = node_data.get("saveResponseTo")
            
            logger.debug(f"[GPTQuery Node Debug] prompt_template: '{prompt_template}'")
            logger.debug(f"[GPTQuery Node Debug] apiKeyVariableName (lido do nó): '{api_key_variable_name_from_node}'")
            logger.debug(f"[GPTQuery Node Debug] variable_to_save_response: '{variable_to_save_response}'")

            ai_model = node_data.get("model"); ai_temp = node_data.get("temperature"); ai_max_tokens = node_data.get("maxTokens")

            if not prompt_template or not variable_to_save_response or not api_key_variable_name_from_node:
                logger.error(f"Nó gptQuery {active_node_id} mal configurado: falta prompt ('{prompt_template}'), saveResponseTo ('{variable_to_save_response}') ou apiKeyVariable ('{api_key_variable_name_from_node}').")
                user_vars[variable_to_save_response if variable_to_save_response else "gpt_error"] = "ERRO_CONFIG_IA: Nó de IA mal configurado."
                potential_next_node_id_after_processing = determine_next_node_id_from_edges(active_node_id, "_internal_error_", user_vars, node_type)
                if not potential_next_node_id_after_processing: potential_next_node_id_after_processing = determine_next_node_id_from_edges(active_node_id, "_internal_transition_", user_vars, node_type)
            else:
                processed_prompt = process_text_variables(prompt_template, user_vars)
                processed_system_message = process_text_variables(system_message_template, user_vars) if system_message_template else None
                api_key = user_vars.get(api_key_variable_name_from_node)
                
                if not api_key:
                    logger.error(f"Nó gptQuery {active_node_id}: API Key não encontrada na variável de fluxo '{api_key_variable_name_from_node}'.")
                    user_vars[variable_to_save_response] = f"ERRO_IA: API Key '{api_key_variable_name_from_node}' não definida."
                    potential_next_node_id_after_processing = determine_next_node_id_from_edges(active_node_id, "_internal_error_", user_vars, node_type)
                    if not potential_next_node_id_after_processing: potential_next_node_id_after_processing = determine_next_node_id_from_edges(active_node_id, "_internal_transition_", user_vars, node_type)
                else:
                    logger.info(f"Nó gptQuery {active_node_id}: API Key recuperada de '{api_key_variable_name_from_node}'. Enviando prompt: '{processed_prompt[:70]}...'")
                    V50MCP_AI_QUERY_API_URL = os.environ.get("V50MCP_AI_QUERY_API_URL")
                    if not V50MCP_AI_QUERY_API_URL:
                        logger.error(f"Nó gptQuery {active_node_id}: V50MCP_AI_QUERY_API_URL não configurada."); user_vars[variable_to_save_response] = "ERRO_CONFIG_CTRL: URL da API de IA não configurada."
                        potential_next_node_id_after_processing = determine_next_node_id_from_edges(active_node_id, "_internal_error_", user_vars, node_type) # Tenta sair por erro
                        if not potential_next_node_id_after_processing: potential_next_node_id_after_processing = determine_next_node_id_from_edges(active_node_id, "_internal_transition_", user_vars, node_type) # Ou saida normal
                    else:
                        try:
                            api_payload = {"prompt": processed_prompt, "apiKey": api_key, "systemMessage": processed_system_message, "model": ai_model, "temperature": ai_temp, "maxTokens": ai_max_tokens }
                            api_payload = {k: v for k, v in api_payload.items() if v is not None}
                            logger.debug(f"Payload para {V50MCP_AI_QUERY_API_URL}: {json.dumps(api_payload)}")
                            response = requests.post(V50MCP_AI_QUERY_API_URL, json=api_payload, timeout=60)
                            response.raise_for_status()
                            api_response_data = response.json()
                            if api_response_data.get("success") and "response" in api_response_data:
                                user_vars[variable_to_save_response] = api_response_data["response"]
                                logger.info(f"Nó gptQuery {active_node_id}: Resposta da IA salva em '{variable_to_save_response}'.")
                            else:
                                error_detail = api_response_data.get("details") or api_response_data.get("message", "Erro da API de IA.")
                                logger.error(f"Nó gptQuery {active_node_id}: Falha na API de IA: {error_detail}")
                                user_vars[variable_to_save_response] = f"ERRO_IA_API: {str(error_detail)[:200]}"
                        except requests.exceptions.Timeout: user_vars[variable_to_save_response] = "ERRO_IA_TIMEOUT"; logger.error(f"Timeout (60s) ao chamar API de IA.")
                        except requests.exceptions.RequestException as e: user_vars[variable_to_save_response] = f"ERRO_IA_CONEXAO: {str(e)[:100]}"; logger.error(f"Erro de requisição à API de IA: {e}")
                        except Exception as e: user_vars[variable_to_save_response] = f"ERRO_IA_INESPERADO: {str(e)[:100]}"; logger.error(f"Erro inesperado ao processar IA: {e}", exc_info=True)
                potential_next_node_id_after_processing = determine_next_node_id_from_edges(active_node_id, "_internal_transition_", user_vars, node_type) # Sempre tenta transição padrão após gptQuery
            current_message_trigger = "_internal_transition_"
        
        elif node_type == "condition":
            is_true_branch = evaluate_condition(node_data, current_message_trigger, user_vars)
            handle_to_follow = 'source-true' if is_true_branch else 'source-false'
            edge_found = next((e for e in current_flow_definition.get("edges", []) if e.get('source') == active_node_id and e.get('sourceHandle') == handle_to_follow), None)
            if edge_found: potential_next_node_id_after_processing = edge_found.get('target')
            else: logger.warning(f"Condition: Nó {active_node_id}, não encontrada edge para handle '{handle_to_follow}'.")
            current_message_trigger = "_internal_transition_"

        elif node_type in ["textMessage", "imageMessage", "audioMessage", "videoMessage", "fileMessage", "locationMessage", "buttonMessage", "listMessage", "endFlow"]: # Adicionado buttonMessage e listMessage aqui
            if node_type == "endFlow": logger.info(f"EndFlow: Nó {active_node_id} atingido."); next_node_id_for_session_update = None; break
            # Para nós de mensagem que não são interativos (ou interativos que já mostraram seu prompt e agora só transicionam)
            if node_type not in ["buttonMessage", "listMessage"] or current_message_trigger == "_internal_transition_":
                 potential_next_node_id_after_processing = determine_next_node_id_from_edges(active_node_id, "_internal_transition_", user_vars, node_type)
                 if not potential_next_node_id_after_processing: next_node_id_for_session_update = None; break 
                 current_message_trigger = "_internal_transition_"
            else: # É buttonMessage ou listMessage e recebeu um input do usuário (trigger_value não é interno)
                potential_next_node_id_after_processing = determine_next_node_id_from_edges(active_node_id, current_message_trigger, user_vars, node_type)
                current_message_trigger = "_internal_transition_"

        elif node_type == "startNode":
            potential_next_node_id_after_processing = determine_next_node_id_from_edges(active_node_id, "_internal_transition_", user_vars, node_type)
            current_message_trigger = "_internal_transition_"
        
        else: 
            logger.warning(f"Loop {hop_count}: Tipo de nó '{node_type}' (ID: {active_node_id}) não tratado explicitamente. Verificando edges padrão.");
            potential_next_node_id_after_processing = determine_next_node_id_from_edges(active_node_id, "_internal_transition_", user_vars, node_type)
            current_message_trigger = "_internal_transition_"
            if not potential_next_node_id_after_processing and node_type not in ["waitInput", "buttonMessage", "listMessage"]:
                 next_node_id_for_session_update = None; break

        if potential_next_node_id_after_processing:
            active_node_id = potential_next_node_id_after_processing
            user_session["history"].append({"transitioned_to_node": active_node_id, "via_trigger": current_message_trigger})
            logger.info(f"Transição para '{active_node_id}'.")
            if response_payload_to_send is None:
                next_node_object_check = get_node_by_id(active_node_id)
                if next_node_object_check:
                    next_node_type_check = next_node_object_check.get("type")
                    message_sending_node_types = ["textMessage", "imageMessage", "audioMessage", "videoMessage", "fileMessage", "locationMessage", "buttonMessage", "listMessage", "endFlow", "waitInput"]
                    if next_node_type_check in message_sending_node_types:
                        logger.debug(f"Após transição para {active_node_id} (tipo {next_node_type_check}), gerando seu payload.")
                        response_payload_to_send = get_response_payload_for_node(active_node_id, user_vars)
        else: 
            logger.info(f"Loop {hop_count}: Nenhuma transição de '{active_node_id}'.")
            if node_type not in ["waitInput", "buttonMessage", "listMessage"]: next_node_id_for_session_update = None
            else: next_node_id_for_session_update = active_node_id
            break 
    
    if hop_count >= max_hops: logger.error(f"Max hops atingido."); response_payload_to_send = {"type":"text", "text": "Erro."}; next_node_id_for_session_update = None 
    
    if sender_id in user_states:
        if next_node_id_for_session_update is not None:
            user_states[sender_id]["current_node_id"] = next_node_id_for_session_update
            logger.info(f"Sessão {sender_id} atualizada. Próx nó: '{next_node_id_for_session_update}'. Vars: {json.dumps(user_vars)}")
        else:
            logger.info(f"Fim do fluxo/erro para {sender_id}. Removendo sessão.")
            del user_states[sender_id]

    final_response_data = {}
    if response_payload_to_send: final_response_data["response_payload"] = response_payload_to_send
    logger.info(f"API /process_message: Respondendo Next.js para {sender_id} {'COM' if response_payload_to_send else 'SEM'} payload.")
    return jsonify(final_response_data), 200

@app.route('/reload_flow', methods=['POST'])
def reload_flow_endpoint():
    logger.info("API /reload_flow: Solicitada recarga.")
    previous_flow_id = current_flow_definition.get("id")
    success = load_flow_from_db()
    if success:
        if previous_flow_id is None or current_flow_definition.get("id") != previous_flow_id :
            logger.info(f"Fluxo alterado/carregado (ID: {current_flow_definition.get('id')}). Limpando {len(user_states)} estados de usuário.")
            user_states.clear()
        else: 
            logger.info("Fluxo recarregado, ID e nó inicial são os mesmos. Estados mantidos.")
        return jsonify({"success": True, "message": f"Fluxo '{current_flow_definition.get('name', 'N/A')}' (ID: {current_flow_definition.get('id')}) recarregado."}), 200
    return jsonify({"success": False, "message": "Falha ao recarregar fluxo."}), 500

@app.route('/health', methods=['GET'])
def health_check():
    flow_loaded_ok = ( current_flow_definition.get("id") is not None and
                       current_flow_definition.get("start_node_id") is not None and
                       get_node_by_id(current_flow_definition.get("start_node_id")) is not None )
    db_ok = False; db_err_msg = "N/A"
    try: conn_test = get_mysql_connection(); conn_test.close(); db_ok = True
    except Exception as e: db_err_msg = str(e)
    is_healthy = flow_loaded_ok and db_ok
    status_data = {"status": "ok" if is_healthy else "degraded", "details": {"flow_loaded": flow_loaded_ok, "db_connection": db_ok}}
    if not flow_loaded_ok: status_data["details"]["flow_error"] = "Fluxo não carregado ou inválido."
    if not db_ok: status_data["details"]["db_error"] = db_err_msg
    logger.info(f"Health check: {status_data['status']}")
    return jsonify(status_data), 200 if is_healthy else 503

@app.route('/', methods=['GET', 'POST'])
def root_route():
    return jsonify({ "message": "Flow Controller Service (MySQL) is running." }), 200

logger.info("Módulo flow_controller.py carregado. Tentando carregar fluxo inicial...")
if not load_flow_from_db():
    logger.critical("FALHA CRÍTICA AO CARREGAR FLUXO INICIAL NA INICIALIZAÇÃO.")
else:
    logger.info("Fluxo inicial carregado com sucesso.")

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5001)) 
    debug_mode = os.environ.get('FLASK_ENV', 'development').lower() == 'development'
    logger.info(f"Iniciando Flask app em modo {'debug' if debug_mode else 'produção'} na porta {port}.")
    app.run(host='0.0.0.0', port=port, debug=debug_mode)
