"use client";

import { useState, useRef, useEffect, KeyboardEvent, ReactNode } from "react";
import { MessageCircle, X, SendHorizontal } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const WELCOME: Message = {
  role: "assistant",
  content:
    "Hallo! 👋 Ik ben de Mvolo AI assistant. Ik kan je helpen met vragen over je dashboard data — zoals orders, revenue, geo statistieken, SEO prestaties, en meer. Wat wil je weten?",
  timestamp: new Date(),
};

function getDashboardContext(): string {
  return JSON.stringify({
    period: "Deze maand",
    orders: { total: 1247, change: "+12%" },
    revenue: { total: "€184,320", change: "+8.5%" },
    bestChannel: "Google Ads",
    avgOrderValue: "€147.80",
    newCustomers: 342,
    returningPct: "34%",
    adSpend: "€12,400",
    roas: "4.2x",
    poas: "2.8x",
    cac: "€36.26",
    geo: {
      topCountry: "Nederland",
      topCity: "Amsterdam",
      internationalOrders: "18%",
    },
    seo: {
      organicSessions: "24,531",
      rankedKeywords: "1,247",
      avgPosition: "12.4",
      backlinks: "3,892",
      seoScore: "78/100",
    },
    topProducts: [
      "Lichttherapie Lamp Pro",
      "Wake-up Light Premium",
      "UV-vrije Lichttherapie",
    ],
  });
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
}

function renderContent(text: string, isUser: boolean) {
  const lines = text.split("\n");
  const elements: ReactNode[] = [];
  let i = 0;
  let k = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") {
      elements.push(<div key={k++} className="h-1.5" />);
    } else if (line.trim().startsWith("•")) {
      const bullets: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("•")) {
        bullets.push(lines[i].trim().slice(1).trim());
        i++;
      }
      elements.push(
        <ul key={k++} className="space-y-1 mt-0.5">
          {bullets.map((b, bi) => (
            <li key={bi} className="flex items-start gap-1.5">
              <span className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${isUser ? "bg-blue-200" : "bg-blue-400 dark:bg-blue-500"}`} />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    } else {
      elements.push(<p key={k++} className="leading-relaxed">{line}</p>);
    }
    i++;
  }

  return <div className="space-y-1 text-sm">{elements}</div>;
}

export default function AIChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      inputRef.current?.focus();
    }
  }, [isOpen, messages]);

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    setInput("");
    setMessages((prev) => [
      ...prev,
      { role: "user", content: trimmed, timestamp: new Date() },
    ]);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          dashboardContext: getDashboardContext(),
        }),
      });

      const data = await res.json();
      const content = data.reply
        ? data.reply
        : `Error: ${data.error ?? "Unknown error"}`;
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content, timestamp: new Date() },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Network error: ${err?.message ?? "Could not reach /api/chat"}`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === "Escape") {
      setIsOpen(false);
    }
  }

  return (
    <>
      {/* ── Chat panel ── */}
      <div
        className={`
          fixed bottom-24 right-4 sm:right-6 z-50
          w-[calc(100vw-2rem)] sm:w-105
          h-[70vh] sm:h-140
          bg-white dark:bg-gray-900
          rounded-2xl shadow-2xl
          border border-gray-200 dark:border-gray-700
          flex flex-col
          transition-all duration-300 ease-in-out
          ${isOpen
            ? "opacity-100 translate-y-0 pointer-events-auto"
            : "opacity-0 translate-y-4 pointer-events-none"
          }
        `}
        role="dialog"
        aria-label="Mvolo AI Assistant"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
              <span className="text-white font-bold text-xs">AI</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                Mvolo AI Assistant
              </p>
              <p className="text-[10px] text-green-500 font-medium">Online</p>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:text-gray-500 dark:hover:text-white dark:hover:bg-gray-800 transition-colors"
            aria-label="Sluit chat"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
            >
              <div
                className={`
                  px-4 py-2.5 text-sm max-w-[85%]
                  ${msg.role === "user"
                    ? "bg-blue-600 text-white rounded-2xl rounded-tr-md"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-2xl rounded-tl-md"
                  }
                `}
              >
                {renderContent(msg.content, msg.role === "user")}
              </div>
              {mounted && (
                <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 px-1">
                  {formatTime(msg.timestamp)}
                </span>
              )}
            </div>
          ))}

          {/* Typing indicator */}
          {loading && (
            <div className="flex flex-col items-start">
              <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl rounded-tl-md px-4 py-3">
                <div className="flex gap-1 px-1">
                  <span
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: "0ms" }}
                  />
                  <span
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: "150ms" }}
                  />
                  <span
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: "300ms" }}
                  />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center gap-2 shrink-0">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Stel een vraag over je data..."
            disabled={loading}
            className="flex-1 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-60"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="ml-2 p-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
            aria-label="Verstuur bericht"
          >
            <SendHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Floating toggle button ── */}
      <button
        onClick={() => setIsOpen((o) => !o)}
        className="fixed bottom-6 right-4 sm:right-6 z-50 w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/25 flex items-center justify-center transition-colors"
        aria-label={isOpen ? "Sluit AI chat" : "Open AI chat"}
      >
        {isOpen ? (
          <X className="w-5 h-5" />
        ) : (
          <MessageCircle className="w-5 h-5 sm:w-6 sm:h-6" />
        )}
      </button>
    </>
  );
}
