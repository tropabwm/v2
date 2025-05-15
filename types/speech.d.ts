// types/speech.d.ts

// Declaração para a interface SpeechRecognitionEvent (necessária por SpeechRecognition)
interface SpeechRecognitionEvent extends Event {
    readonly resultIndex: number;
    readonly results: SpeechRecognitionResultList;
    readonly interpretation?: any; // Algumas implementações podem ter isso
    readonly emma?: Document; // Algumas implementações podem ter isso
}

// Declaração para a interface SpeechRecognitionResultList (necessária por SpeechRecognitionEvent)
interface SpeechRecognitionResultList {
    readonly length: number;
    item(index: number): SpeechRecognitionResult;
    [index: number]: SpeechRecognitionResult;
}

// Declaração para a interface SpeechRecognitionResult (necessária por SpeechRecognitionResultList)
interface SpeechRecognitionResult {
    readonly length: number;
    item(index: number): SpeechRecognitionAlternative;
    [index: number]: SpeechRecognitionAlternative;
    readonly isFinal: boolean;
}

// Declaração para a interface SpeechRecognitionAlternative (necessária por SpeechRecognitionResult)
interface SpeechRecognitionAlternative {
    readonly transcript: string;
    readonly confidence: number;
}

// Declaração para a interface SpeechGrammar (usada por SpeechRecognition)
interface SpeechGrammar {
    src: string;
    weight: number;
}

// Declaração para a interface SpeechGrammarList (usada por SpeechRecognition)
interface SpeechGrammarList {
    readonly length: number;
    item(index: number): SpeechGrammar;
    [index: number]: SpeechGrammar;
    addFromURI(src: string, weight?: number): void;
    addFromString(string: string, weight?: number): void;
}

// Declaração principal para SpeechRecognition
interface SpeechRecognition extends EventTarget {
    grammars: SpeechGrammarList;
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    maxAlternatives: number;
    serviceURI?: string; // Opcional em algumas implementações

    onaudiostart: ((this: SpeechRecognition, ev: Event) => any) | null;
    onaudioend: ((this: SpeechRecognition, ev: Event) => any) | null;
    onend: ((this: SpeechRecognition, ev: Event) => any) | null;
    onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null; // Corrigido para SpeechRecognitionErrorEvent
    onnomatch: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
    onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
    onsoundstart: ((this: SpeechRecognition, ev: Event) => any) | null;
    onsoundend: ((this: SpeechRecognition, ev: Event) => any) | null;
    onspeechstart: ((this: SpeechRecognition, ev: Event) => any) | null;
    onspeechend: ((this: SpeechRecognition, ev: Event) => any) | null;
    onstart: ((this: SpeechRecognition, ev: Event) => any) | null;

    abort(): void;
    start(): void;
    stop(): void;
}

// Declaração para o construtor de SpeechRecognition
declare var SpeechRecognition: {
    prototype: SpeechRecognition;
    new(): SpeechRecognition;
};

// Declaração para webkitSpeechRecognition (para compatibilidade com Chrome/Safari mais antigos)
declare var webkitSpeechRecognition: {
    prototype: SpeechRecognition; // Assume que webkitSpeechRecognition implementa a mesma interface base
    new(): SpeechRecognition;
};

// Declaração para SpeechRecognitionErrorEvent (usada por onerror)
interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string; // Ou um enum específico de erros se conhecido
  readonly message?: string;
}
