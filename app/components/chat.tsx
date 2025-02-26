"use client";

import React, { useState, useEffect, useRef } from "react";
import styles from "./chat.module.css";
import { AssistantStream } from "openai/lib/AssistantStream";
import Markdown from "react-markdown";
// @ts-expect-error - no types for this yet
import { AssistantStreamEvent } from "openai/resources/beta/assistants/assistants";
import { RequiredActionFunctionToolCall } from "openai/resources/beta/threads/runs/runs";

type MessageProps = {
  role: "user" | "assistant" | "code";
  text: string;
};

const UserMessage = ({ text }: { text: string }) => {
  return <div className={styles.userMessage}>{text}</div>;
};

const AssistantMessage = ({ text }: { text: string }) => {
  // Fonction pour nettoyer les références de citation comme 【8:7†source】
  const cleanText = (text: string) => {
    return text.replace(/【[^】]*】/g, '');
  };

  return (
    <div className={styles.assistantMessage}>
      <Markdown>{cleanText(text)}</Markdown>
    </div>
  );
};

const CodeMessage = ({ text }: { text: string }) => {
  return (
    <div className={styles.codeMessage}>
      {text.split("\n").map((line, index) => (
        <div key={index}>
          <span>{`${index + 1}. `}</span>
          {line}
        </div>
      ))}
    </div>
  );
};

const Message = ({ role, text }: MessageProps) => {
  switch (role) {
    case "user":
      return <UserMessage text={text} />;
    case "assistant":
      return <AssistantMessage text={text} />;
    case "code":
      return <CodeMessage text={text} />;
    default:
      return null;
  }
};

type ChatProps = {
  functionCallHandler?: (
    toolCall: RequiredActionFunctionToolCall
  ) => Promise<string>;
};

const Chat = ({
  functionCallHandler = () => Promise.resolve(""), // default to return empty string
}: ChatProps) => {
  const [userInput, setUserInput] = useState("");
  const [messages, setMessages] = useState<MessageProps[]>([]);
  const [inputDisabled, setInputDisabled] = useState(false);
  const [threadId, setThreadId] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Suggestions de questions spécifiques au Festival Classiquicime Megève 2025
  const suggestions = [
    "Quels concerts sont prévus pour le Festival Classiquicime 2025 ?",
    "Quels artistes seront présents au Festival ?",
    "Quand aura lieu le prochain concert à Megève ?",
    "Où puis-je acheter des billets pour le Festival ?",
    "Y a-t-il des activités pour les enfants pendant le Festival ?",
    "Quels sont les tarifs des concerts ?",
  ];

  // Fonction pour sélectionner une suggestion
  const handleSuggestionClick = (suggestion: string) => {
    setUserInput(suggestion);
  };

  // Vérifier si c'est le premier chargement (aucun message)
  const isFirstLoad = messages.length === 0;

  // automatically scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // create a new threadID when chat component created
  useEffect(() => {
    const createThread = async () => {
      try {
        const response = await fetch("/api/assistants/threads", {
          method: "POST",
        });

        if (!response.ok) {
          throw new Error(`Erreur HTTP: ${response.status}`);
        }

        const { threadId: newThreadId } = await response.json();
        setThreadId(newThreadId);
      } catch (error) {
        console.error("Erreur lors de la création du thread:", error);
        // Afficher un message d'erreur dans l'interface
        appendMessage("assistant", "Désolé, une erreur s'est produite lors de l'initialisation du chat. Veuillez rafraîchir la page.");
      }
    };
    createThread();
  }, []);

  const submitMessage = async (content: string) => {
    try {
      const response = await fetch(`/api/assistants/threads/${threadId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content }),
      });

      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }

      const data = response.body;
      if (!data) {
        throw new Error("Aucune donnée reçue");
      }

      const reader = data.getReader();
      const stream = new AssistantStream(reader);
      handleReadableStream(stream);
    } catch (error) {
      console.error("Erreur lors de l'envoi du message:", error);
      appendMessage("assistant", "Désolé, une erreur s'est produite lors de l'envoi de votre message. Veuillez réessayer.");
      setInputDisabled(false);
    }
  };

  const submitActionResult = async (runId, toolCallOutputs) => {
    try {
      const response = await fetch(
        `/api/assistants/threads/${threadId}/actions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            runId,
            toolCallOutputs,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }

      const data = response.body;
      if (!data) {
        throw new Error("Aucune donnée reçue");
      }

      const reader = data.getReader();
      const stream = new AssistantStream(reader);
      handleReadableStream(stream);
    } catch (error) {
      console.error("Erreur lors de la soumission des résultats d'action:", error);
      appendMessage("assistant", "Désolé, une erreur s'est produite lors du traitement de votre demande. Veuillez réessayer.");
      setInputDisabled(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!userInput.trim()) return;
    submitMessage(userInput);
    setMessages((prevMessages) => [
      ...prevMessages,
      { role: "user", text: userInput },
    ]);
    setUserInput("");
    setInputDisabled(true);
    scrollToBottom();
  };

  /* Stream Event Handlers */

  // textCreated - create new assistant message
  const handleTextCreated = () => {
    appendMessage("assistant", "");
  };

  // textDelta - append text to last assistant message
  const handleTextDelta = (delta) => {
    if (delta.value != null) {
      appendToLastMessage(delta.value);
    };
    /* Commenté - annotations désactivées
    if (delta.annotations != null) {
      annotateLastMessage(delta.annotations);
    }
    */
  };

  // imageFileDone - show image in chat
  const handleImageFileDone = (image) => {
    appendToLastMessage(`\n![${image.file_id}](/api/files/${image.file_id})\n`);
  }

  // toolCallCreated - log new tool call
  const toolCallCreated = (toolCall) => {
    if (toolCall.type != "code_interpreter") return;
    appendMessage("code", "");
  };

  // toolCallDelta - log delta and snapshot for the tool call
  const toolCallDelta = (delta, snapshot) => {
    if (delta.type != "code_interpreter") return;
    if (!delta.code_interpreter.input) return;
    appendToLastMessage(delta.code_interpreter.input);
  };

  // handleRequiresAction - handle function call
  const handleRequiresAction = async (
    event: AssistantStreamEvent.ThreadRunRequiresAction
  ) => {
    const runId = event.data.id;
    const toolCalls = event.data.required_action.submit_tool_outputs.tool_calls;
    // loop over tool calls and call function handler
    const toolCallOutputs = await Promise.all(
      toolCalls.map(async (toolCall) => {
        const result = await functionCallHandler(toolCall);
        return { output: result, tool_call_id: toolCall.id };
      })
    );
    setInputDisabled(true);
    submitActionResult(runId, toolCallOutputs);
  };

  // handleRunCompleted - re-enable the input form
  const handleRunCompleted = () => {
    setInputDisabled(false);
  };

  const handleReadableStream = (stream: AssistantStream) => {
    // messages
    stream.on("textCreated", handleTextCreated);
    stream.on("textDelta", handleTextDelta);

    // image
    stream.on("imageFileDone", handleImageFileDone);

    // code interpreter
    stream.on("toolCallCreated", toolCallCreated);
    stream.on("toolCallDelta", toolCallDelta);

    // events without helpers yet (e.g. requires_action and run.done)
    stream.on("event", (event) => {
      if (event.event === "thread.run.requires_action")
        handleRequiresAction(event);
      if (event.event === "thread.run.completed") handleRunCompleted();
    });

    // Gestion des erreurs du stream
    stream.on("error", (error) => {
      console.error("Stream error:", error);
      // Afficher un message d'erreur à l'utilisateur
      appendMessage("assistant", "Désolé, une erreur s'est produite. Veuillez réessayer votre question.");
      setInputDisabled(false);
    });

    // Gestion de la fin du stream
    stream.on("end", () => {
      // Assurer que l'input est réactivé même si completed n'est pas reçu
      setInputDisabled(false);
    });
  };

  /*
    =======================
    === Utility Helpers ===
    =======================
  */

  const appendToLastMessage = (text) => {
    setMessages((prevMessages) => {
      const lastMessage = prevMessages[prevMessages.length - 1];
      const updatedLastMessage = {
        ...lastMessage,
        text: lastMessage.text + text,
      };
      return [...prevMessages.slice(0, -1), updatedLastMessage];
    });
  };

  const appendMessage = (role, text) => {
    setMessages((prevMessages) => [...prevMessages, { role, text }]);
  };

  /* Commenté - fonction d'annotations désactivée
  const annotateLastMessage = (annotations) => {
    setMessages((prevMessages) => {
      const lastMessage = prevMessages[prevMessages.length - 1];
      const updatedLastMessage = {
        ...lastMessage,
      };
      annotations.forEach((annotation) => {
        if (annotation.type === 'file_path') {
          updatedLastMessage.text = updatedLastMessage.text.replaceAll(
            annotation.text,
            `/api/files/${annotation.file_path.file_id}`
          );
        }
      })
      return [...prevMessages.slice(0, -1), updatedLastMessage];
    });
    
  }
  */

  return (
    <div className={styles.chatContainer}>
      <div className={styles.chatHeader}>
        <div className={styles.chatTitle}>Festival Classiquicime Megève 2025 <br/>Concert Musique Classique</div>
        <div className={styles.chatStatus}>
          <div className={styles.statusDot}></div>
          En ligne
        </div>
      </div>
      <div className={styles.messages}>
        {isFirstLoad ? (
          <div className={styles.emptyStateContainer}>
            <div className={styles.emptyStateIcon}>🎻</div>
            <div className={styles.emptyStateTitle}>Bienvenue au Festival Classiquicime Megève 2025</div>
            <div className={styles.emptyStateDescription}>
              Posez vos questions sur le programme, les artistes, les lieux de concert, les tarifs ou toute autre information concernant le festival.
            </div>
            <div className={styles.suggestionsContainer}>
              <div className={styles.suggestionsTitle}>Essayez ces questions :</div>
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  className={styles.suggestionButton}
                  onClick={() => handleSuggestionClick(suggestion)}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, index) => (
              <Message key={index} role={msg.role} text={msg.text} />
            ))}
            {inputDisabled && (
              <div className={styles.typingIndicator}>
                <div className={styles.typingDot}></div>
                <div className={styles.typingDot}></div>
                <div className={styles.typingDot}></div>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>
      <form
        onSubmit={handleSubmit}
        className={`${styles.inputForm} ${styles.clearfix}`}
      >
        <input
          type="text"
          className={styles.input}
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          placeholder="Quelle est votre question sur le Festival ?"
        />
        <button
          type="submit"
          className={styles.button}
          disabled={inputDisabled}
        >
          Envoyer
        </button>
      </form>
    </div>
  );
};

export default Chat;
