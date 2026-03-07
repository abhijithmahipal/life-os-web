"use client";

import { useState, useRef, useEffect } from "react";
import { Mic, Send, Bot, User, CheckCircle2, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type Message = {
  id: string;
  role: "user" | "archivist";
  content: string;
  filesModified?: string[];
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "archivist",
      content: "Hello! I am Antigravity, your Life OS archivist. Tap the microphone and tell me what's on your mind. I'll automatically organize it into your Second Brain.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Web Speech API references
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // Scroll to bottom when messages change
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    // Initialize Speech Recognition
    if (typeof window !== "undefined") {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true;

        recognitionRef.current.onresult = (event: any) => {
          let currentTranscript = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            currentTranscript += event.results[i][0].transcript;
          }
          setInput((prev) => prev + " " + currentTranscript.trim());
        };

        recognitionRef.current.onerror = (event: any) => {
          console.error("Speech recognition error", event.error);
          setIsRecording(false);
        };
      }
    }
  }, []);

  const toggleRecording = () => {
    if (isRecording) {
       recognitionRef.current?.stop();
       setIsRecording(false);
    } else {
       setInput(""); // Clear previous input on new record
       recognitionRef.current?.start();
       setIsRecording(true);
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    
    // Stop recording if active
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
    }

    const newMsg: Message = { id: Date.now().toString(), role: "user", content: input };
    setMessages((prev) => [...prev, newMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: newMsg.content }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            role: "archivist",
            content: data.summary,
            filesModified: data.filesModified,
          },
        ]);
      } else {
         throw new Error(data.error);
      }
    } catch (error: any) {
       setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
             role: "archivist",
             content: "Error connecting to the archivist: " + error.message,
          },
        ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex flex-col h-screen bg-slate-950 text-slate-50 font-sans selection:bg-indigo-500/30">
      {/* Header */}
      <header className="flex items-center justify-between p-6 border-b border-slate-800/60 bg-slate-900/50 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
            <Bot className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Life OS</h1>
            <p className="text-xs text-slate-400">Powered by Antigravity</p>
          </div>
        </div>
      </header>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div 
                className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-4 shadow-sm ${
                  msg.role === "user" 
                    ? "bg-indigo-600 text-white rounded-br-none" 
                    : "bg-slate-800/80 border border-slate-700 text-slate-200 rounded-bl-none"
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5 opacity-70">
                   {msg.role === "archivist" ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
                   <span className="text-xs font-medium">{msg.role === "archivist" ? "Archivist" : "You"}</span>
                </div>
                <p className="leading-relaxed">{msg.content}</p>
                
                {/* File Modification Chips */}
                {msg.filesModified && msg.filesModified.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-700/50">
                    <p className="text-xs font-medium text-slate-400 mb-2">Updated Files:</p>
                    <div className="flex flex-wrap gap-2">
                       {msg.filesModified.map(file => (
                         <div key={file} className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-900/50 border border-slate-700/50 text-xs text-emerald-400">
                           <CheckCircle2 className="w-3 h-3" />
                           {file}
                         </div>
                       ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
          {isLoading && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex justify-start"
            >
              <div className="bg-slate-800/80 border border-slate-700 rounded-2xl rounded-bl-none p-4 flex items-center gap-3">
                <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
                <span className="text-sm text-slate-400">Archivist is organizing...</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 sm:p-6 bg-slate-900/80 border-t border-slate-800/60 backdrop-blur-lg">
        <div className="max-w-4xl mx-auto relative flex items-center">
          <button
            onClick={toggleRecording}
            className={`absolute left-3 p-2.5 rounded-full transition-all ${
              isRecording 
                ? "bg-rose-500/20 text-rose-400 animate-pulse" 
                : "bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700"
            }`}
          >
            <Mic className="w-5 h-5" />
          </button>
          
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder={isRecording ? "Listening..." : "Type or tap the mic to speak..."}
            className="w-full bg-slate-800/50 border border-slate-700 rounded-full py-4 pl-14 pr-14 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-slate-200 placeholder-slate-500 shadow-inner"
          />
          
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="absolute right-3 p-2.5 bg-indigo-600 text-white rounded-full hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        <p className="text-center text-xs text-slate-500 mt-3">
           Your thoughts are securely synced to GitHub.
        </p>
      </div>
    </main>
  );
}
