'use client';
import { useState } from 'react';
import { useChat } from '@/hooks/useChat'; // Lưu ý dấu @ trỏ thẳng vào root

export default function Home() {
  const { messages, sendMessage, emotion } = useChat("bao_uit");
  const [input, setInput] = useState("");

  return (
    <div className="p-10 bg-gray-900 min-h-screen text-white">
      <h1 className="text-2xl font-bold mb-4">SoulMate Test UI</h1>
      <p className="mb-4 text-blue-400">Cảm xúc nhận diện: {emotion}</p>
      
      <div className="border border-gray-700 h-96 overflow-y-auto p-4 mb-4 rounded bg-gray-800">
        {messages.map((m, i) => (
          <p key={i} className={m.role === 'user' ? "text-right text-green-400" : "text-left text-white"}>
            <strong>{m.role}:</strong> {m.content}
          </p>
        ))}
      </div>

      <div className="flex gap-2">
        <input 
          className="flex-1 p-2 bg-black border border-gray-600 rounded"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button 
          onClick={() => { sendMessage(input); setInput(""); }}
          className="bg-blue-600 px-4 py-2 rounded"
        >
          Gửi
        </button>
      </div>
    </div>
  );
}