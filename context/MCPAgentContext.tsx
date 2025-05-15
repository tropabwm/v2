// context/MCPAgentContext.tsx
import React, { createContext, useState, useContext, ReactNode, useMemo, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { useRouter } from 'next/router';
import { useAuth } from './AuthContext';
import { useToast } from "@/components/ui/use-toast";
import { Message, SavedConversationMetadata, FullSavedConversation } from '@/types/chat'; // <<< IMPORTADO DE TYPES/CHAT

// Interface Message local removida, pois agora é importada

type UbieLanguage = 'pt-BR' | 'en-US';

// CORREÇÃO: Definir as interfaces AgentAction e AgentApiResponse aqui para que o contexto possa usá-las
interface AgentAction { type: 'navigate' | 'copy_suggestion' | string; payload?: any; }
interface AgentApiResponse { response: string; action?: AgentAction | null; } // Define AgentApiResponse interface here

interface MCPAgentContextType {
  isAgentPanelOpen: boolean;
  toggleAgentPanel: () => void;
  messages: Message[];
  sendMessage: (message: string, currentPath: string) => Promise<void>;
  isLoading: boolean;
  sessionId: string;
  startNewConversation: () => void;
  savedConversations: SavedConversationMetadata[];
  currentlyLoadedConversation: FullSavedConversation | null;
  loadSavedConversations: () => Promise<void>;
  saveConversation: (name: string) => Promise<void>;
  loadConversation: (savedConversationId: number) => Promise<void>;
  resumeSavedConversation: (savedConversationId: number) => Promise<void>;
  deleteConversation: (savedConversationId: number) => Promise<void>;
  ubieLanguage: UbieLanguage;
  setUbieLanguage: (language: UbieLanguage) => void;
  lastDataChangeTimestamp: number;
  notifyDataChange: () => void;
}

const MCPAgentContext = createContext<MCPAgentContextType | undefined>(undefined);

export const useMCPAgentContext = () => {
  const context = useContext(MCPAgentContext);
  if (context === undefined) {
    throw new Error('useMCPAgentContext must be used within a MCPAgentProvider');
  }
  return context;
};

export const MCPAgentProvider = ({ children }: { children: ReactNode }) => {
  const [isAgentPanelOpen, setIsAgentPanelOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [savedConversations, setSavedConversations] = useState<SavedConversationMetadata[]>([]);
  const [currentlyLoadedConversation, setCurrentlyLoadedConversation] = useState<FullSavedConversation | null>(null);
  const [ubieLanguage, setUbieLanguageState] = useState<UbieLanguage>('pt-BR');
  const [lastDataChangeTimestamp, setLastDataChangeTimestamp] = useState<number>(Date.now());

  const router = useRouter();
  const { isAuthenticated, token } = useAuth();
  const { toast } = useToast();

  // Initialize sessionId from localStorage or generate new
  const [sessionId, setSessionId] = useState<string>(() => {
      const storageKey = 'currentMcpSessionId';
      // Use initial state function to only read localStorage once on mount
      if (typeof window !== 'undefined') {
          const savedSessionId = localStorage.getItem(storageKey);
          if (savedSessionId) return savedSessionId;
      }
      const newSessionId = uuidv4();
      // No localStorage write here, it happens in useEffect or startNewConversation
      return newSessionId;
  });

  // Initialize messages from localStorage for the current session ID
  const [messages, setMessages] = useState<Message[]>(() => {
      // Initial state function
      if (typeof window !== 'undefined') {
           const currentSessionIdFromStorage = localStorage.getItem('currentMcpSessionId');
           const idToLoad = currentSessionIdFromStorage || 'initial_session'; // Use a temporary key if no session yet

           // IMPORTANT: Inital state functions should be pure.
           // Reading localStorage here might be tricky depending on render cycles.
           // A better approach is often to initialize empty and load in useEffect.
           // However, let's stick to the current pattern but refine localStorage key logic.

           // Use the sessionId state variable which is initialized above
           // This relies on sessionId being correctly initialized before messages.
           // If sessionId reads from localStorage first, this *might* work.
           const savedMessages = localStorage.getItem(`mcpMessages_${sessionId}`); // Use the state sessionId
           if (savedMessages) {
               try {
                   const parsedMessages = JSON.parse(savedMessages);
                   if (Array.isArray(parsedMessages)) {
                       console.log(`[MCP Context] Initializing with ${parsedMessages.length} messages from localStorage for session ${sessionId}`);
                       return parsedMessages;
                   }
               } catch (e) {
                   console.error(`Failed to parse saved messages from localStorage for session ${sessionId}`, e);
                   localStorage.removeItem(`mcpMessages_${sessionId}`); // Clear corrupted data
               }
           }
      }
      console.log(`[MCP Context] Initializing with empty messages for session ${sessionId}`);
      return []; // Start with empty array if no saved messages or not in browser
  });

  // Effect to save messages to localStorage whenever they change for the current session
  useEffect(() => {
      if (typeof window !== 'undefined' && sessionId) {
          // Avoid saving the thinking message state if possible, or handle it.
          // Simplest: Save messages excluding any temporary 'thinking' messages.
          const messagesToSave = messages.filter(msg => !msg.isThinking);
          if (messagesToSave.length > 0) {
              localStorage.setItem(`mcpMessages_${sessionId}`, JSON.stringify(messagesToSave));
             // console.log(`[MCP Context] Saved ${messagesToSave.length} messages to localStorage for session ${sessionId}`); // Log less frequently
          } else {
              // If messages become empty (e.g., new conversation), remove from storage
              localStorage.removeItem(`mcpMessages_${sessionId}`);
             // console.log(`[MCP Context] Cleared messages from localStorage for session ${sessionId}`); // Log less frequently
          }
      }
  }, [messages, sessionId]); // Depend on messages and sessionId


  const notifyDataChange = useCallback(() => {
    console.log("[MCPAgentContext] Notifying data change, updating timestamp.");
    setLastDataChangeTimestamp(Date.now());
  }, []);


  const toggleAgentPanel = useCallback(() => {
    setIsAgentPanelOpen(prev => !prev);
  }, []);

    // Start a new conversation
    const startNewConversation = useCallback(() => {
        console.log("[MCP Context] Starting new conversation...");
        const newSessionId = uuidv4();
        const oldSessionId = sessionId; // Capture current sessionId before state update

        if (typeof window !== 'undefined') {
            // Optionally keep old conversation in localStorage if user wants to resume later
            // localStorage.removeItem(`mcpMessages_${oldSessionId}`); // Only remove if explicitly discarding
            localStorage.setItem('currentMcpSessionId', newSessionId); // Update active session ID
            console.log(`[MCP Context] Switched active session from ${oldSessionId} to ${newSessionId}`);
        } else {
             console.log(`[MCP Context] Started new session ${newSessionId} (not in browser).`);
        }

        setSessionId(newSessionId); // Update state
        setMessages([]); // Clear messages for the new session
        setCurrentlyLoadedConversation(null); // Ensure we are not viewing a saved conversation
        toast({ title: "New Conversation Started", description: "Your previous chat is saved if you logged in.", variant: "default" }); // User feedback
    }, [sessionId, setSessionId, setMessages, setCurrentlyLoadedConversation, toast]); // Added toast to dependencies

    // Load list of saved conversations
  const loadSavedConversations = useCallback(async () => {
       if (!isAuthenticated || !token) {
           setSavedConversations([]); // Clear saved list if not authenticated
           return;
       }
       try {
           const response = await axios.get<SavedConversationMetadata[]>('/api/mcp-saved-conversations', {
               headers: { Authorization: `Bearer ${token}` },
           });
           setSavedConversations(response.data);
           console.log(`[MCP Context] Loaded ${response.data.length} saved conversations.`);
       } catch (error: any) {
            console.error("[MCP Context] Error loading saved conversations list:", error);
            toast({
              title: "Error Loading Saved Conversations",
              description: error.response?.data?.error || error.message || "Failed to fetch saved conversations list.",
              variant: "destructive",
           });
       }
  }, [isAuthenticated, token, toast]); // Depend on isAuthenticated, token, and toast

    // Save the current conversation session
  const saveConversation = useCallback(async (name: string) => {
       if (!isAuthenticated || !token || !sessionId) {
           toast({ title: "Authentication Required", description: "Please log in to save conversations.", variant: "destructive" });
           return;
       }
        // Only save messages that are not temporary thinking messages
        const messagesToSave = messages.filter(msg => !msg.isThinking);
        if (messagesToSave.length === 0) {
               toast({ title: "Cannot Save Empty Conversation", description: "There are no messages to save.", variant: "default" });
               return;
          }
       setIsLoading(true);
       try {
           // Send sessionId and current messages to the save API
           const response = await axios.post<FullSavedConversation>('/api/mcp-saved-conversations', {
               sessionId: sessionId,
               name: name,
               history: messagesToSave, // Save filtered messages
           }, {
               headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
           });
           toast({ title: "Conversation Saved", description: `Conversation "${response.data.name}" saved.`, variant: "default" });
           loadSavedConversations(); // Refresh the list after saving
       } catch (error: any) {
           console.error("[MCP Context] Error saving conversation:", error);
           const errorMessage = error.response?.data?.message || error.response?.data?.error || error.message || "Failed to save conversation.";
            toast({ title: "Error Saving Conversation", description: errorMessage, variant: "destructive" });
       } finally {
            setIsLoading(false);
       }
  }, [isAuthenticated, token, sessionId, messages, toast, loadSavedConversations]); // Depend on messages, sessionId, auth state, toast, and loadSavedConversations

    // Load a saved conversation to *view* it, without changing the active session
  const loadConversation = useCallback(async (savedConversationId: number) => {
       if (!isAuthenticated || !token) {
           toast({ title: "Authentication Required", description: "Please log in to load conversations.", variant: "destructive" });
           return;
       }
       setIsLoading(true);
       try {
           // Fetch the full conversation history
           const response = await axios.get<FullSavedConversation>(`/api/mcp-saved-conversations?id=${savedConversationId}`, {
               headers: { Authorization: `Bearer ${token}` },
           });
           const fullConversation = response.data;
           // Set messages state to the loaded history (for viewing)
           setMessages(fullConversation.history);
           // Set currently loaded conversation metadata
           setCurrentlyLoadedConversation(fullConversation);
           toast({ title: "Conversation Loaded", description: `Viewing "${fullConversation.name}". Your current chat session is unchanged.`, variant: "default" });
       } catch (error: any) {
           console.error("[MCP Context] Error loading conversation:", error);
           const errorMessage = error.response?.data?.error || error.message || "Failed to load conversation.";
            toast({ title: "Error Loading Conversation", description: errorMessage, variant: "destructive" });
           // Clear viewed state on error
           setMessages([]); // Clear messages if loading fails
           setCurrentlyLoadedConversation(null);
       } finally {
          setIsLoading(false);
       }
  }, [isAuthenticated, token, toast, setMessages, setCurrentlyLoadedConversation]); // Depend on auth state, toast, and message/currentlyLoaded state setters

    // Resume a saved conversation, making it the *active* session
    const resumeSavedConversation = useCallback(async (savedConversationId: number) => {
         if (!isAuthenticated || !token) {
             toast({ title: "Authentication Required", description: "Please log in to resume.", variant: "destructive" });
             return;
         }
         setIsLoading(true);
         try {
             // Fetch the full conversation history
             const response = await axios.get<FullSavedConversation>(`/api/mcp-saved-conversations?id=${savedConversationId}`, {
                 headers: { Authorization: `Bearer ${token}` },
             });
             const fullConversation = response.data;

             // Clear messages from previous active session in localStorage
             if (typeof window !== 'undefined' && sessionId) {
                 localStorage.removeItem(`mcpMessages_${sessionId}`); // Remove data of the session being replaced
                 console.log(`[MCP Context] Cleared messages from localStorage for session ${sessionId} (resuming).`);
             }

             // Set the active session ID to the saved conversation's session ID
             setSessionId(fullConversation.session_id);
             // Update localStorage with the new active session ID
             if (typeof window !== 'undefined') {
                  localStorage.setItem('currentMcpSessionId', fullConversation.session_id);
                  // Store the messages of the resumed conversation in localStorage
                  localStorage.setItem(`mcpMessages_${fullConversation.session_id}`, JSON.stringify(fullConversation.history));
                  console.log(`[MCP Context] Saved messages to localStorage for resumed session ${fullConversation.session_id}.`);
             }

             // Set messages state to the loaded history
             setMessages(fullConversation.history);
             // Set currently loaded conversation metadata
             setCurrentlyLoadedConversation(fullConversation); // Still 'currently loaded' as it's now the active one
             toast({ title: "Conversation Resumed", description: `Switched to "${fullConversation.name}".`, variant: "default" });
         } catch (error: any) {
             console.error("[MCP Context] Error resuming conversation:", error);
             const errorMessage = error.response?.data?.error || error.message || "Failed to resume conversation.";
              toast({ title: "Error Resuming Conversation", description: errorMessage, variant: "destructive" });
              // On error, maybe revert to the previous active session if possible, or start fresh?
              // For now, just show error and stay on current state (which might be empty if it was a new session)
         } finally {
             setIsLoading(false);
         }
    }, [isAuthenticated, token, toast, sessionId, setSessionId, setMessages, setCurrentlyLoadedConversation]); // Depend on auth state, toast, sessionId, and state setters

    // Delete a saved conversation
  const deleteConversation = useCallback(async (savedConversationId: number) => {
       if (!isAuthenticated || !token) {
           toast({ title: "Authentication Required", description: "Please log in to delete.", variant: "destructive" });
           return;
       }
       setIsLoading(true);
       try {
           // Send DELETE request to the API
           const response = await axios.delete<{ success: boolean; message?: string }>(`/api/mcp-saved-conversations?savedConversationId=${savedConversationId}`, {
               headers: { Authorization: `Bearer ${token}` },
           });
           toast({ title: "Conversation Deleted", description: response.data.message || "Deleted successfully.", variant: "default" });
           // Update the list of saved conversations
           setSavedConversations(prev => prev.filter(conv => conv.id !== savedConversationId));

           // If the conversation being deleted is the one currently *viewed* or the *active* session
           if (currentlyLoadedConversation?.id === savedConversationId) {
                // Clear the currently viewed conversation state
                setCurrentlyLoadedConversation(null);
                // If the deleted session was ALSO the active session, clear local storage and messages
                 const activeSessionId = (typeof window !== 'undefined' && localStorage.getItem('currentMcpSessionId')) || sessionId;
                if (activeSessionId === savedConversationId.toString()) { // Compare string IDs
                    if (typeof window !== 'undefined') {
                        localStorage.removeItem(`mcpMessages_${activeSessionId}`);
                         localStorage.removeItem('currentMcpSessionId'); // Clear the session ID itself
                         console.log(`[MCP Context] Cleared localStorage for deleted active session ${activeSessionId}.`);
                    }
                     // Generate a new session ID
                    const newSessionId = uuidv4();
                    setSessionId(newSessionId);
                     if (typeof window !== 'undefined') {
                         localStorage.setItem('currentMcpSessionId', newSessionId);
                          console.log(`[MCP Context] Started new active session ${newSessionId} after deleting previous active one.`);
                     }
                    setMessages([]); // Clear messages for the new session
                    toast({ title: "Active Conversation Deleted", description: "Started a new chat session.", variant: "default" });
                } else {
                     // If the deleted session was only *viewed*, revert messages to the current active session's history
                    let activeSessionMessages: Message[] = [];
                    if (typeof window !== 'undefined' && activeSessionId) {
                        const savedMsgs = localStorage.getItem(`mcpMessages_${activeSessionId}`);
                        if (savedMsgs) try { activeSessionMessages = JSON.parse(savedMsgs); } catch {}
                    }
                    setMessages(activeSessionMessages); // Load active session messages
                    toast({ title: "Viewed Conversation Deleted", description: "Returned to your active chat session.", variant: "default" });
                }
           }
           notifyDataChange(); // Notify components that data might have changed (e.g., if campaign created via saved convo)
       } catch (error: any) {
           console.error("[MCP Context] Error deleting conversation:", error);
           const errorMessage = error.response?.data?.message || error.response?.data?.error || error.message || "Failed to delete.";
            toast({ title: "Error Deleting Conversation", description: errorMessage, variant: "destructive" });
       } finally {
           setIsLoading(false);
       }
  }, [isAuthenticated, token, toast, currentlyLoadedConversation, notifyDataChange, sessionId, setMessages, setCurrentlyLoadedConversation, setSavedConversations]); // Added all dependencies

    // Send message to the agent API and handle response/actions
  const sendMessage = useCallback(
    async (message: string, currentPath: string) => {
      // Prevent sending if not authenticated, no session, or already loading
      if (!sessionId || !isAuthenticated || isLoading) {
        if (!isAuthenticated) {
             toast({ title: "Authentication Required", description: "Please log in to use Ubie.", variant: "destructive" });
        } else if (!sessionId) {
             console.error("[MCP Context] sendMessage called without a valid session ID.");
              toast({ title: "Agent Error", description: "No active session. Please try starting a new conversation.", variant: "destructive" });
        }
        return;
      }

      const userMessage: Message = { id: uuidv4(), role: "user", content: message, timestamp: Date.now() };

      // If currently viewing a *saved* conversation, switch back to the active session
      // and add the new message there.
      let currentActiveSessionMessages: Message[] = messages; // Assume 'messages' state holds active session history by default
      if (currentlyLoadedConversation) {
           // Load messages for the *current* active session ID from localStorage
           const activeSessionIdFromStorage = (typeof window !== 'undefined' && localStorage.getItem('currentMcpSessionId')) || sessionId;
           if (typeof window !== 'undefined' && activeSessionIdFromStorage) {
                const savedMsgs = localStorage.getItem(`mcpMessages_${activeSessionIdFromStorage}`);
                if (savedMsgs) {
                    try {
                         currentActiveSessionMessages = JSON.parse(savedMsgs);
                         console.log(`[MCP Context] Loaded active session (${activeSessionIdFromStorage}) messages from localStorage.`);
                    } catch (e) {
                         console.error("Failed to parse active session messages from localStorage", e);
                         currentActiveSessionMessages = []; // Fallback to empty on error
                         localStorage.removeItem(`mcpMessages_${activeSessionIdFromStorage}`); // Clear corrupted data
                    }
                } else {
                     currentActiveSessionMessages = []; // If no saved messages for active session
                }
           } else {
                currentActiveSessionMessages = []; // If no active session ID in storage (shouldn't happen if sessionId state is correct)
           }

           // Clear the saved conversation viewing state
           setCurrentlyLoadedConversation(null);
           console.log("[MCP Context] Switched from viewing saved conversation to active session.");
      }

      // Add the new user message to the history we will display and send
      const messagesToSend = [...currentActiveSessionMessages, userMessage];
      setMessages(messagesToSend); // Update state to show the new user message immediately


      setIsLoading(true);
      const thinkingMessageId = uuidv4();
      const thinkingMessage: Message = { id: thinkingMessageId, role: "assistant", content: null, isThinking: true, timestamp: Date.now() };
      // Add thinking message to the UI temporarily
      setMessages((prevMessages) => [...prevMessages, thinkingMessage]);

      try {
        // Send the message and context to the backend API
        const response = await axios.post('/api/mcp-agent', {
            message: message,
            context: { path: router.pathname, lang: ubieLanguage }, // Use router.pathname for current path
        }, {
            headers: { 'X-Session-ID': sessionId, Authorization: `Bearer ${token}` },
        });

        const agentResponseData: AgentApiResponse = response.data; // Use AgentApiResponse interface
        // Remove the thinking message from UI
        setMessages((prevMessages) => prevMessages.filter(msg => msg.id !== thinkingMessageId));

        const assistantMessageContent = agentResponseData.response || "Sorry, I couldn't generate a response.";
        const assistantMessage: Message = {
          id: uuidv4(), role: "assistant", content: assistantMessageContent, timestamp: Date.now()
        };

        // Add the assistant's final response to the UI
        setMessages((prevMessages) => [...prevMessages, assistantMessage]);

        // Process actions returned by the agent
        if (agentResponseData.action) {
             console.log("[MCP Context] Received action from agent:", agentResponseData.action);
             switch (agentResponseData.action.type) {
                  case 'navigate':
                      if (agentResponseData.action.payload?.path) {
                           router.push(agentResponseData.action.payload.path);
                           // If navigating, data on destination page might need refresh
                           notifyDataChange(); // Notify just in case navigation implies data view change
                      }
                      break;
                  case 'copy_suggestion':
                       // The payload should contain the suggested text.
                       // You might want to trigger a UI update or store this suggestion
                       // in a dedicated state or a separate context if needed elsewhere.
                       // For now, just log it and rely on the agent's text response for display.
                       console.log("[MCP Context] Received copy suggestion:", agentResponseData.action.payload);
                       // The agent's text response should contain the suggestion, so no extra UI update needed here usually.
                       // You might want to add the suggestion to the message object itself if the UI should render it specially.
                       // assistantMessage.suggestion = agentResponseData.action.payload; // Example
                       break;
                  case 'data_changed_campaigns': // Example custom action type from backend
                       notifyDataChange(); // Explicitly notify if the action type says data changed
                       break;
                  default:
                       console.warn(`[MCP Context] Received unknown action type: ${agentResponseData.action.type}`);
                       // Handle other custom actions if defined
                       break;
             }
        } else {
             // If no specific action, check if the text response implies a data change
             // This is less reliable than explicit action types from the backend
              const responseImpliesCampaignChange = assistantMessageContent.toLowerCase().includes("campanha") && (assistantMessageContent.toLowerCase().includes("criada") || assistantMessageContent.toLowerCase().includes("atualizada") || assistantMessageContent.toLowerCase().includes("deletada"));
              if (responseImpliesCampaignChange) {
                  console.log("[MCPAgentContext] Response content implies campaign data change (heuristic). Notifying...");
                  notifyDataChange(); // Notify based on text heuristic
              }
        }


      } catch (error: any) {
          // Handle API errors
          console.error(`[MCP Context] Error sending message to API for session ${sessionId}:`, error);
          // Remove thinking message
          setMessages((prevMessages) => prevMessages.filter(msg => msg.id !== thinkingMessageId));

          const errorMessage = error.response?.data?.message || error.response?.data?.error || error.message || "An unexpected error occurred.";
          const errorDetails = error.response?.data?.details ? `Details: ${error.response.data.details}` : '';
           const sqlMessage = error.response?.data?.sqlMessage ? `SQL Error: ${error.response.data.sqlMessage}` : ''; // Capture SQL error details if available
           const fullErrorMessage = `Error: ${errorMessage} ${errorDetails} ${sqlMessage}`.trim();


          // Add an error message to the UI
          const errorUbieMessage: Message = {
              id: uuidv4(),
              role: "assistant",
              content: fullErrorMessage,
              error: fullErrorMessage, // Store error details if needed
              timestamp: Date.now()
          };
          // Use prevMessages to add the error message to the current state
          setMessages((prevMessages) => [...prevMessages, errorUbieMessage]);

           toast({ title: "Ubie Agent Error", description: fullErrorMessage, variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    },
    // Added all dependencies including those used in axios.post and state updates
    [sessionId, isAuthenticated, token, router, toast, ubieLanguage, notifyDataChange, messages, currentlyLoadedConversation, setMessages, setIsLoading, setCurrentlyLoadedConversation] // Ensure all dependencies are listed
  );

    // Effect to load saved conversations on authentication status change
  useEffect(() => {
    if (isAuthenticated) {
        loadSavedConversations();
    } else {
        // Clear saved conversations list if user logs out
        setSavedConversations([]);
        // If user logs out while viewing a saved conversation, clear viewed state
        if (currentlyLoadedConversation) {
             setCurrentlyLoadedConversation(null);
             // Clear messages on logout if viewing saved
             setMessages([]);
        } else {
             // If user logs out while in an active session, messages might contain unsaved history.
             // Keeping them in state is fine until they navigate or start new convo.
             // localStorage should handle persistence across page loads.
        }
    }
    // Include dependencies
  }, [isAuthenticated, loadSavedConversations, currentlyLoadedConversation, setCurrentlyLoadedConversation, setMessages, setSavedConversations]);


    // Effect to initialize messages from localStorage when sessionId changes (e.g., on page load or resuming saved)
    // This is a fallback to ensure messages are loaded if the initial state didn't catch them.
    // It also ensures messages are loaded when resuming a saved conversation (sessionId changes).
  useEffect(() => {
       // Only attempt to load from localStorage if in a browser environment and not currently viewing a saved conversation
       if (typeof window !== 'undefined' && sessionId && !currentlyLoadedConversation && !isLoading) {
           const savedMessages = localStorage.getItem(`mcpMessages_${sessionId}`);
           if (savedMessages) {
               try {
                   const parsedMessages = JSON.parse(savedMessages);
                   // Only load if the current messages state is empty or different from localStorage
                   // Avoid infinite loops if setMessages triggers this effect when state is already correct
                   if (Array.isArray(parsedMessages) && parsedMessages.length > 0) {
                       // Compare current messages state with parsed messages from storage
                       // A deep comparison might be expensive, a simple length check or flag might suffice
                       // If messages state is empty, definitely load from storage
                       if (messages.length === 0) {
                           console.log(`[MCP Context] Effect loaded ${parsedMessages.length} messages from localStorage for session ${sessionId}.`);
                           setMessages(parsedMessages);
                       } else {
                            // If messages state is not empty, assume it's already the correct active session state
                            console.log(`[MCP Context] Messages state already populated (${messages.length}), skipping localStorage load in effect.`);
                       }
                   } else {
                       console.log(`[MCP Context] No saved messages or empty array found in localStorage for session ${sessionId}.`);
                       // If localStorage had empty/invalid array, clear it
                       if (savedMessages !== '[]') localStorage.removeItem(`mcpMessages_${sessionId}`);
                   }
               } catch (e) {
                   console.error(`Failed to parse messages from localStorage for session ${sessionId} in effect`, e);
                   localStorage.removeItem(`mcpMessages_${sessionId}`); // Clear corrupted data
               }
           } else {
                console.log(`[MCP Context] No messages found in localStorage for session ${sessionId}.`);
           }
       } else {
            // console.log(`[MCP Context] Effect skipped localStorage load. Is client: ${typeof window !== 'undefined'}, sessionId: ${sessionId}, currentlyLoaded: ${!!currentlyLoadedConversation}, isLoading: ${isLoading}, messagesCount: ${messages.length}`);
       }
       // Depend on sessionId, currentlyLoadedConversation, isLoading, and setMessages.
       // Also depend on `messages` state itself to avoid re-loading into an already populated state
  }, [sessionId, currentlyLoadedConversation, isLoading, setMessages, messages]); // Added messages as dependency, check logic carefully

  const setLanguage = useCallback((language: UbieLanguage) => {
      setUbieLanguageState(language);
      // TODO: Consider adding a mechanism to notify the backend of the language change for future messages
      // Maybe save to localStorage or send a special message/parameter to the agent API?
  }, [setUbieLanguageState]); // Added setUbieLanguageState as dependency

  const value = useMemo(() => ({
    isAgentPanelOpen,
    toggleAgentPanel,
    messages,
    sendMessage,
    isLoading,
    sessionId,
    startNewConversation,
    savedConversations,
    currentlyLoadedConversation,
    loadSavedConversations,
    saveConversation,
    loadConversation,
    resumeSavedConversation,
    deleteConversation,
    ubieLanguage,
    setUbieLanguage: setLanguage,
    lastDataChangeTimestamp,
    notifyDataChange,
  }), [
      isAgentPanelOpen, toggleAgentPanel, messages, sendMessage, isLoading, sessionId,
      startNewConversation, savedConversations, currentlyLoadedConversation,
      loadSavedConversations, saveConversation, loadConversation, resumeSavedConversation,
      deleteConversation, ubieLanguage, setLanguage, lastDataChangeTimestamp, notifyDataChange
  ]); // Ensure all values used in the context value are listed as dependencies

  return (
    <MCPAgentContext.Provider value={value}>
      {children}
    </MCPAgentContext.Provider>
  );
};
