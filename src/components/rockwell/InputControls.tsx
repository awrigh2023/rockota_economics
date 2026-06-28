import { FormEvent, useState } from 'react';
import { Send } from 'lucide-react';

interface InputControlsProps {
  onSend: (text: string) => void;
  streaming: boolean;
  disabled?: boolean;
}

export default function InputControls({ onSend, streaming, disabled }: InputControlsProps) {
  const [input, setInput] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!input.trim() || streaming || disabled) return;
    onSend(input.trim());
    setInput('');
  }

  return (
    <div className="px-4 py-3 bg-white border-t border-gray-200">
      {disabled ? (
        <div className="text-center text-xs text-gray-400 py-1">
          <a href="/login" className="text-[#d7c770] hover:underline">Log in</a> to chat with Rockwell
        </div>
      ) : streaming ? (
        <div className="flex items-center justify-center gap-2 text-xs text-gray-400 py-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[#d7c770]/60 animate-pulse" />
          Rockwell is thinking…
        </div>
      ) : null}
      <form
        onSubmit={handleSubmit}
        className="flex items-center bg-white rounded-full border border-gray-200 focus-within:border-rw-gold/60 transition-colors mt-1 shadow-sm"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={disabled ? 'Log in to chat…' : 'Ask Rockwell…'}
          className="flex-1 bg-transparent px-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 outline-none"
          disabled={streaming || disabled}
        />
        <button
          type="submit"
          disabled={streaming || !input.trim() || disabled}
          className="px-3 py-2 mr-1 rounded-full bg-rw-gold text-rw-navy font-medium text-sm hover:bg-rw-gold-dark disabled:opacity-30 transition-colors flex items-center gap-1"
        >
          <Send size={14} />
        </button>
      </form>
    </div>
  );
}
