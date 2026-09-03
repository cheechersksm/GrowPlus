import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, Bot, User, Settings, Sparkles, RefreshCw, Copy, Check, 
  Trash2, MessageSquare, Code, Lightbulb, Zap, HelpCircle, 
  ChevronDown, Moon, Sun, AlertCircle, Cpu, Sliders,
  Image as ImageIcon, X, Calculator, BookOpen, Paperclip
} from 'lucide-react';

export default function App() {
  // State
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      sender: 'ai',
      text: "Hello! I'm your Math Tutor Assistant 📐. You can ask me math questions or upload an image of any equation, problem, or diagram, and I'll explain how to solve it step-by-step!",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null); // { file, previewUrl, base64Data, mimeType }
  
  // Settings & Personas
  const [persona, setPersona] = useState('math_tutor');
  const [model, setModel] = useState('gemini-3-flash-preview');
  const [useLiveApi, setUseLiveApi] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [temperature, setTemperature] = useState(0.4);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // Auto scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Handle Image Selection and Convert to Base64
  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64Str = reader.result.split(',')[1];
      setSelectedImage({
        file,
        previewUrl: URL.createObjectURL(file),
        base64Data: base64Str,
        mimeType: file.type
      });
    };
    reader.readAsDataURL(file);
    // Reset file input so re-selecting same image works
    e.target.value = '';
  };

  const removeSelectedImage = () => {
    if (selectedImage?.previewUrl) {
      URL.revokeObjectURL(selectedImage.previewUrl);
    }
    setSelectedImage(null);
  };

  // System instructions based on persona
  const getSystemInstruction = () => {
    switch (persona) {
      case 'math_tutor':
        return 'You are an expert, encouraging Mathematics Tutor Assistant. When presented with a math question or an image containing math equations, geometry diagrams, calculus, or word problems: 1. Identify and restate the problem clearly. 2. Provide a detailed step-by-step solution breakdown. 3. Explain key formulas, theorems, and mathematical reasoning used. 4. Highlight common mistakes to avoid. Use clean formatting and mathematical notation.';
      case 'coder':
        return 'You are an expert software developer and coding tutor. Provide clear, modular, well-commented code snippets and explanations.';
      case 'creative':
        return 'You are a creative writer and brainstorming partner. Give inventive, inspiring, and rich responses.';
      case 'concise':
        return 'You are a direct, concise assistant. Answer questions as briefly as possible while remaining accurate and clear.';
      case 'teacher':
        return 'You are a patient educational tutor. Break down complex concepts into simple steps with real-world analogies.';
      default:
        return 'You are a helpful, respectful, and friendly AI assistant.';
    }
  };

  // API Call function with exponential backoff and Multimodal Image Support
  const callGeminiAPI = async (userPrompt, chatHistory, currentImage) => {
    const apiKey = ""; // API key supplied by execution environment at runtime

    // Build contents array with previous chat history
    const contents = chatHistory.map(msg => {
      const parts = [];
      if (msg.image) {
        parts.push({
          inlineData: {
            mimeType: msg.image.mimeType,
            data: msg.image.base64Data
          }
        });
      }
      if (msg.text) {
        parts.push({ text: msg.text });
      }
      return {
        role: msg.sender === 'user' ? 'user' : 'model',
        parts
      };
    });

    // Construct current turn parts
    const currentParts = [];
    if (currentImage) {
      currentParts.push({
        inlineData: {
          mimeType: currentImage.mimeType,
          data: currentImage.base64Data
        }
      });
    }
    
    const promptText = userPrompt.trim() || (currentImage ? "Please analyze this image, extract the math problem, and explain step-by-step how to solve it." : "Help me solve this math problem.");
    currentParts.push({ text: promptText });

    contents.push({
      role: 'user',
      parts: currentParts
    });

    const payload = {
      contents,
      systemInstruction: {
        parts: [{ text: getSystemInstruction() }]
      },
      generationConfig: {
        temperature: temperature
      }
    };

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    let attempts = 0;
    const maxAttempts = 5;
    let delay = 1000;

    while (attempts < maxAttempts) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          throw new Error(`API Error: ${response.status}`);
        }

        const data = await response.json();
        const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (responseText) {
          return responseText;
        } else {
          throw new Error('Empty response from model');
        }
      } catch (error) {
        attempts++;
        if (attempts >= maxAttempts) {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
      }
    }
  };

  // Fallback AI responder if live API fails or is toggled off
  const getMockResponse = (userPrompt, hasImage) => {
    if (hasImage) {
      return "📐 **Image Math Analysis**:\n\n1. **Identified Equation**: `∫ (2x + 3) dx`\n2. **Step 1**: Apply the power rule of integration `∫ x^n dx = (x^(n+1))/(n+1)`.\n3. **Step 2**: Integrate each term separately:\n   - `∫ 2x dx = x^2`\n   - `∫ 3 dx = 3x`\n4. **Final Solution**: `x^2 + 3x + C`\n\n*Tip*: Always remember to add the constant of integration `C` for indefinite integrals!";
    }
    const lower = userPrompt.toLowerCase();
    if (lower.includes('hello') || lower.includes('hi')) {
      return "Hello! I am your Math Tutor Assistant. Upload a photo of your math equation or question, and I'll walk you through the step-by-step solution!";
    } else if (lower.includes('pythagorean') || lower.includes('triangle')) {
      return "The Pythagorean Theorem states that in a right-angled triangle, **a² + b² = c²**, where c is the hypotenuse.\n\nExample:\nIf a = 3 and b = 4:\n3² + 4² = 9 + 16 = 25\nc = √25 = 5.";
    } else {
      return `Here is a step-by-step mathematical breakdown for your inquiry:\n\n1. **Core Problem**: Analyzing "${userPrompt}"\n2. **Strategy**: Apply fundamental algebraic rules.\n3. **Result**: Step-by-step derivation verified. Let me know if you would like to test with another problem or upload an image!`;
    }
  };

  const handleSend = async (textToSend = input) => {
    if ((!textToSend.trim() && !selectedImage) || isLoading) return;

    const imageForMsg = selectedImage; // snapshot reference
    const userMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: textToSend.trim(),
      image: imageForMsg ? {
        previewUrl: imageForMsg.previewUrl,
        base64Data: imageForMsg.base64Data,
        mimeType: imageForMsg.mimeType
      } : null,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setSelectedImage(null);
    setIsLoading(true);

    try {
      let aiText = '';
      if (useLiveApi) {
        aiText = await callGeminiAPI(textToSend, messages, imageForMsg);
      } else {
        await new Promise(r => setTimeout(r, 1200));
        aiText = getMockResponse(textToSend, !!imageForMsg);
      }

      const aiMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: aiText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (err) {
      console.error(err);
      const errorMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: "Sorry, I ran into an error processing your request. Here is a simulated response instead:\n\n" + getMockResponse(textToSend, !!imageForMsg),
        isError: true,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClear = () => {
    setMessages([
      {
        id: 'welcome',
        sender: 'ai',
        text: "Chat history cleared! Feel free to upload an image of a math problem or ask a question.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  };

  const quickPrompts = [
    { label: "Calculus Integral", icon: Calculator, text: "Explain how to solve ∫ (3x² + 2x + 1) dx step-by-step." },
    { label: "Geometry Theorem", icon: BookOpen, text: "Explain the Pythagorean theorem with a practical example." },
    { label: "Algebra Word Problem", icon: Lightbulb, text: "A train leaves at 60mph and another at 80mph. Solve when they meet." },
    { label: "Photo Problem", icon: ImageIcon, text: "Upload a photo of a math worksheet to get step-by-step help." }
  ];

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-slate-100 font-sans antialiased">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-slate-800/80 border-b border-slate-700/60 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-tr from-indigo-500 to-emerald-500 rounded-xl shadow-lg shadow-indigo-500/20">
            <Calculator className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              Math Tutor AI Assistant
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-normal">
                Vision Supported
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              Mode: <span className="capitalize text-slate-300 font-medium">Math Tutor Assistant</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={handleClear}
            title="Clear Chat History"
            className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-700/50 rounded-lg transition-colors"
          >
            <Trash2 className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 rounded-lg transition-colors flex items-center gap-1.5 text-sm font-medium ${
              showSettings 
                ? 'bg-indigo-600 text-white' 
                : 'text-slate-300 hover:bg-slate-700/60'
            }`}
          >
            <Settings className="w-5 h-5" />
            <span className="hidden sm:inline">Settings</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Chat Area */}
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          {/* Messages Stream */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
            {messages.map((msg) => (
              <div 
                key={msg.id}
                className={`flex gap-3 sm:gap-4 max-w-4xl mx-auto ${
                  msg.sender === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {msg.sender === 'ai' && (
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-emerald-600/30 border border-emerald-500/40 flex items-center justify-center flex-shrink-0 mt-1">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                  </div>
                )}

                <div className={`group relative max-w-[85%] sm:max-w-[75%] rounded-2xl p-4 transition-all ${
                  msg.sender === 'user'
                    ? 'bg-indigo-600 text-white rounded-tr-none shadow-md shadow-indigo-600/10'
                    : msg.isError
                    ? 'bg-red-950/40 border border-red-800/50 text-red-200 rounded-tl-none'
                    : 'bg-slate-800/90 border border-slate-700/80 text-slate-100 rounded-tl-none shadow-sm'
                }`}>
                  {/* Sender Header */}
                  <div className="flex items-center justify-between gap-4 mb-1.5 text-xs opacity-75 border-b border-white/10 pb-1">
                    <span className="font-semibold">
                      {msg.sender === 'user' ? 'You' : 'Math Assistant'}
                    </span>
                    <span>{msg.timestamp}</span>
                  </div>

                  {/* Render Uploaded Image if available */}
                  {msg.image && (
                    <div className="mb-3 overflow-hidden rounded-xl border border-white/20 bg-black/20">
                      <img 
                        src={msg.image.previewUrl || `data:${msg.image.mimeType};base64,${msg.image.base64Data}`} 
                        alt="Uploaded problem" 
                        className="max-h-60 w-full object-contain rounded-lg"
                      />
                    </div>
                  )}

                  {/* Text Content */}
                  <div className="text-sm sm:text-base leading-relaxed whitespace-pre-wrap break-words">
                    {msg.text}
                  </div>

                  {/* Message Actions */}
                  <div className="mt-2 pt-1 flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleCopy(msg.text, msg.id)}
                      className="p-1 text-xs text-slate-300 hover:text-white rounded transition"
                      title="Copy message"
                    >
                      {copiedId === msg.id ? (
                        <Check className="w-3.5 h-3.5 text-green-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {msg.sender === 'user' && (
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center flex-shrink-0 mt-1">
                    <User className="w-4 h-4 text-slate-300" />
                  </div>
                )}
              </div>
            ))}

            {/* Loading Indicator */}
            {isLoading && (
              <div className="flex gap-4 max-w-4xl mx-auto items-center">
                <div className="w-9 h-9 rounded-full bg-emerald-600/30 border border-emerald-500/40 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-4 h-4 text-emerald-400 animate-pulse" />
                </div>
                <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl rounded-tl-none px-4 py-3 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  <span className="text-xs text-slate-400 ml-2">Analyzing image & solving math problem...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Prompt Suggestions */}
          {messages.length <= 2 && !isLoading && (
            <div className="px-6 py-2 max-w-4xl mx-auto w-full">
              <p className="text-xs font-medium text-slate-400 mb-2">Suggested topics:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {quickPrompts.map((item, idx) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={idx}
                      onClick={() => {
                        if (item.label === "Photo Problem") {
                          fileInputRef.current?.click();
                        } else {
                          handleSend(item.text);
                        }
                      }}
                      className="flex items-center gap-2.5 p-2.5 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-emerald-500/40 rounded-xl text-left text-xs sm:text-sm text-slate-300 hover:text-white transition group"
                    >
                      <Icon className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform flex-shrink-0" />
                      <span className="truncate">{item.text}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Input Area */}
          <div className="p-4 sm:p-6 bg-slate-900/90 border-t border-slate-800">
            <div className="max-w-4xl mx-auto relative">

              {/* Attached Image Preview Bar */}
              {selectedImage && (
                <div className="mb-2 p-2 bg-slate-800 border border-indigo-500/40 rounded-xl flex items-center justify-between animate-in fade-in duration-200">
                  <div className="flex items-center gap-3">
                    <img 
                      src={selectedImage.previewUrl} 
                      alt="Selected attachment" 
                      className="w-12 h-12 object-cover rounded-lg border border-slate-600"
                    />
                    <div>
                      <p className="text-xs font-medium text-slate-200 truncate max-w-xs sm:max-w-md">
                        {selectedImage.file.name}
                      </p>
                      <p className="text-[10px] text-emerald-400">
                        Image ready for AI visual analysis
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={removeSelectedImage}
                    className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition"
                    title="Remove image"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Hidden File Input */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageChange}
                accept="image/*"
                className="hidden"
              />

              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
                className="flex items-center gap-2 bg-slate-800/90 border border-slate-700/80 rounded-2xl p-2 focus-within:border-emerald-500/80 focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all shadow-lg"
              >
                {/* Image Upload Button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={`p-2.5 rounded-xl transition flex items-center justify-center ${
                    selectedImage 
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' 
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/60'
                  }`}
                  title="Upload image of a math problem or equation"
                >
                  <ImageIcon className="w-5 h-5" />
                </button>

                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder={selectedImage ? "Add notes/instructions or press send..." : "Ask a math question or upload a photo of a problem..."}
                  rows={1}
                  className="flex-1 bg-transparent border-0 text-slate-100 placeholder-slate-400 text-sm sm:text-base focus:outline-none focus:ring-0 resize-none px-2 py-1.5 max-h-32"
                />

                <button
                  type="submit"
                  disabled={(!input.trim() && !selectedImage) || isLoading}
                  className="p-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:opacity-50 text-white rounded-xl transition-all shadow-md flex items-center justify-center flex-shrink-0"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>

              <div className="flex justify-between items-center px-2 mt-2 text-[11px] text-slate-500">
                <span>📷 Click the photo icon to upload equations or homework pages</span>
                <span>Powered by Gemini Vision</span>
              </div>
            </div>
          </div>
        </div>

        {/* Drawer Settings Overlay */}
        {showSettings && (
          <div className="w-full sm:w-80 bg-slate-800 border-l border-slate-700 p-6 flex flex-col justify-between overflow-y-auto absolute right-0 top-0 bottom-0 z-20 shadow-2xl animate-in slide-in-from-right duration-200">
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-700">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-emerald-400" />
                  Chat Settings
                </h2>
                <button 
                  onClick={() => setShowSettings(false)}
                  className="text-slate-400 hover:text-white text-sm"
                >
                  ✕
                </button>
              </div>

              {/* Persona Selection */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  AI Persona
                </label>
                <select
                  value={persona}
                  onChange={(e) => setPersona(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-sm text-slate-200 focus:border-emerald-500 outline-none"
                >
                  <option value="math_tutor">Math Tutor Assistant 📐</option>
                  <option value="teacher">Tutor / General Educator</option>
                  <option value="coder">Coding Specialist</option>
                  <option value="assistant">General Assistant</option>
                  <option value="concise">Concise & Direct</option>
                </select>
              </div>

              {/* Model Selection */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Model
                </label>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-sm text-slate-200 focus:border-emerald-500 outline-none"
                >
                  <option value="gemini-3-flash-preview">Gemini 3 Flash (Multimodal)</option>
                  <option value="gemini-2.5-flash-preview-09-2025">Gemini 2.5 Flash</option>
                </select>
              </div>

              {/* Temperature Slider */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <label className="font-semibold text-slate-300 uppercase tracking-wider">
                    Creativity (Temp)
                  </label>
                  <span className="text-emerald-400 font-mono">{temperature}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  className="w-full accent-emerald-500 bg-slate-900 rounded-lg"
                />
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>Precise (Math)</span>
                  <span>Balanced</span>
                  <span>Creative</span>
                </div>
              </div>

              {/* API Connection Mode */}
              <div className="pt-4 border-t border-slate-700 space-y-3">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                  Backend Mode
                </label>
                <div className="flex items-center justify-between bg-slate-900 p-3 rounded-xl border border-slate-700">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-medium text-slate-200">Live Gemini API</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={useLiveApi}
                    onChange={(e) => setUseLiveApi(e.target.checked)}
                    className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                  />
                </div>
                <p className="text-[11px] text-slate-400 leading-normal">
                  Connects to Gemini API endpoints with visual multimodal reasoning.
                </p>
              </div>
            </div>

            <div className="pt-6 border-t border-slate-700 text-center text-xs text-slate-500">
              Math Tutor AI Web Application v2.0
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
