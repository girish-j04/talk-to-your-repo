import React, { useState, useEffect, useRef } from 'react';
import { Send, Github, FileCode, Folder, File, Loader, MessageSquare, ExternalLink, Copy, Check, Terminal, Zap, Brain, Code2 } from 'lucide-react';
import './main.css';

const API_BASE_URL = 'http://localhost:8000';

// Syntax highlighter
const highlightCode = (code, language = 'javascript') => {
  let highlighted = code;
  
  // Keywords
  const keywords = ['function', 'const', 'let', 'var', 'if', 'else', 'for', 'while', 'return', 'class', 'import', 'export', 'from', 'async', 'await', 'def', 'print', 'true', 'false', 'null', 'undefined'];
  keywords.forEach(keyword => {
    const regex = new RegExp(`\\b${keyword}\\b`, 'g');
    highlighted = highlighted.replace(regex, `<span class="syntax-keyword">${keyword}</span>`);
  });
  
  // Strings
  highlighted = highlighted.replace(/"([^"]*)"/g, '<span class="syntax-string">"$1"</span>');
  highlighted = highlighted.replace(/'([^']*)'/g, '<span class="syntax-string">\'$1\'</span>');
  highlighted = highlighted.replace(/`([^`]*)`/g, '<span class="syntax-string">`$1`</span>');
  
  // Comments
  highlighted = highlighted.replace(/\/\/.*$/gm, '<span class="syntax-comment">$&</span>');
  highlighted = highlighted.replace(/#.*$/gm, '<span class="syntax-comment">$&</span>');
  
  // Numbers
  highlighted = highlighted.replace(/\b\d+(\.\d+)?\b/g, '<span class="syntax-number">$&</span>');
  
  // Function calls
  highlighted = highlighted.replace(/(\w+)(\()/g, '<span class="syntax-function">$1</span>$2');
  
  return highlighted;
};

// File Tree Component
const FileTree = ({ files, onFileSelect }) => {
  const [expandedFolders, setExpandedFolders] = useState(new Set());

  const toggleFolder = (folderPath) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderPath)) {
      newExpanded.delete(folderPath);
    } else {
      newExpanded.add(folderPath);
    }
    setExpandedFolders(newExpanded);
  };

  const renderTree = (tree, path = '') => {
    return Object.entries(tree).map(([name, node]) => {
      const currentPath = path ? `${path}/${name}` : name;
      
      if (node.type === 'file') {
        return (
          <div
            key={currentPath}
            className="file-tree-item flex items-center gap-2"
            onClick={() => onFileSelect(node.path)}
          >
            <File size={14} style={{ color: 'var(--primary)' }} />
            <span>{name}</span>
          </div>
        );
      } else {
        const isExpanded = expandedFolders.has(currentPath);
        return (
          <div key={currentPath}>
            <div
              className="file-tree-item flex items-center gap-2 font-semibold"
              onClick={() => toggleFolder(currentPath)}
              style={{ cursor: 'pointer' }}
            >
              <Folder size={14} style={{ color: isExpanded ? 'var(--secondary)' : 'var(--dark-text-muted)' }} />
              <span>{name}</span>
            </div>
            {isExpanded && (
              <div style={{ marginLeft: '1rem', borderLeft: '1px solid var(--dark-border)' }}>
                {renderTree(node, currentPath)}
              </div>
            )}
          </div>
        );
      }
    });
  };

  return (
    <div style={{ height: '100%', overflowY: 'auto' }}>
      {files?.file_tree ? renderTree(files.file_tree) : (
        <div style={{ textAlign: 'center', color: 'var(--dark-text-muted)', marginTop: '2rem' }}>
          <Folder size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
          <p>No files loaded</p>
        </div>
      )}
    </div>
  );
};

// Message Component
const Message = ({ message, isUser, sources = [] }) => {
  const [copiedCode, setCopiedCode] = useState(null);

  const copyCode = (code, index) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(index);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const renderMessageContent = (content) => {
    // Split by code blocks
    const parts = content.split(/(```[\s\S]*?```)/g);
    
    return parts.map((part, index) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        const lines = part.split('\n');
        const language = lines[0].replace('```', '') || 'text';
        const code = lines.slice(1, -1).join('\n');
        
        return (
          <div key={index} className="code-block" data-language={language}>
            <button
              style={{
                position: 'absolute',
                top: '0.5rem',
                right: '3rem',
                padding: '0.25rem',
                borderRadius: '0.25rem',
                background: 'var(--dark-border)',
                border: 'none',
                color: 'var(--dark-text)',
                cursor: 'pointer',
                transition: 'background 0.2s'
              }}
              onClick={() => copyCode(code, index)}
              onMouseEnter={(e) => e.target.style.background = 'var(--dark-surface)'}
              onMouseLeave={(e) => e.target.style.background = 'var(--dark-border)'}
            >
              {copiedCode === index ? <Check size={14} /> : <Copy size={14} />}
            </button>
            <pre>
              <code dangerouslySetInnerHTML={{ __html: highlightCode(code, language) }} />
            </pre>
          </div>
        );
      } else {
        // Regular text with inline code
        const textWithInlineCode = part.replace(/`([^`]+)`/g, '<code style="background: var(--dark-surface); padding: 0.125rem 0.25rem; border-radius: 0.25rem; color: var(--primary); font-family: var(--font-mono); font-size: 0.875rem;">$1</code>');
        return <div key={index} dangerouslySetInnerHTML={{ __html: textWithInlineCode }} />;
      }
    });
  };

  return (
    <div className={`cyber-card ${isUser ? 'message-user' : 'message-bot'}`} style={{ padding: '1rem', marginBottom: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
        <div style={{ 
          padding: '0.5rem', 
          borderRadius: '0.5rem', 
          background: isUser ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 212, 255, 0.2)' 
        }}>
          {isUser ? <MessageSquare size={16} /> : <Brain size={16} style={{ color: 'var(--primary)' }} />}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ maxWidth: 'none' }}>
            {renderMessageContent(message)}
          </div>
          {sources.length > 0 && (
            <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--dark-border)' }}>
              <div style={{ fontSize: '0.875rem', color: 'var(--dark-text-muted)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Code2 size={14} />
                Sources:
              </div>
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                {sources.map((source, index) => (
                  <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                    <File size={12} style={{ color: 'var(--primary)' }} />
                    <span style={{ fontFamily: 'var(--font-mono)' }}>{source.file_path}</span>
                    <span style={{ color: 'var(--dark-text-muted)' }}>
                      lines {source.start_line}-{source.end_line}
                    </span>
                    <ExternalLink 
                      size={12} 
                      style={{ color: 'var(--dark-text-muted)', cursor: 'pointer', transition: 'color 0.2s' }}
                      onClick={() => window.open(`https://github.com`, '_blank')}
                      onMouseEnter={(e) => e.target.style.color = 'var(--primary)'}
                      onMouseLeave={(e) => e.target.style.color = 'var(--dark-text-muted)'}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Main App Component
const TalkToRepoApp = () => {
  const [repoUrl, setRepoUrl] = useState('');
  const [repoId, setRepoId] = useState(null);
  const [repoStatus, setRepoStatus] = useState(null);
  const [files, setFiles] = useState(null);
  const [messages, setMessages] = useState([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Poll repo status
  useEffect(() => {
    if (repoId && repoStatus?.status === 'processing') {
      const interval = setInterval(async () => {
        try {
          const response = await fetch(`${API_BASE_URL}/api/repos/${repoId}/status`);
          if (response.ok) {
            const status = await response.json();
            setRepoStatus(status);
            
            if (status.status === 'ready') {
              const filesResponse = await fetch(`${API_BASE_URL}/api/repos/${repoId}/files`);
              if (filesResponse.ok) {
                const filesData = await filesResponse.json();
                setFiles(filesData);
              }
              clearInterval(interval);
            }
          }
        } catch (error) {
          console.error('Error checking status:', error);
        }
      }, 2000);

      return () => clearInterval(interval);
    }
  }, [repoId, repoStatus?.status]);

  const processRepo = async () => {
    if (!repoUrl.trim()) return;

    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/repos/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ github_url: repoUrl }),
      });

      if (response.ok) {
        const data = await response.json();
        setRepoId(data.repo_id);
        setRepoStatus(data);
        setMessages([{
          message: `Started processing repository: **${data.name}**\n\nI'm analyzing the codebase and will be ready to chat once processing is complete!`,
          isUser: false,
          sources: []
        }]);
      } else {
        throw new Error('Failed to process repository');
      }
    } catch (error) {
      console.error('Error processing repo:', error);
      setMessages([{
        message: `❌ Failed to process repository. Please check the URL and try again.`,
        isUser: false,
        sources: []
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!currentMessage.trim() || !repoId || repoStatus?.status !== 'ready') return;

    const userMessage = currentMessage;
    setCurrentMessage('');
    setIsSending(true);

    // Add user message
    const newMessages = [...messages, { message: userMessage, isUser: true, sources: [] }];
    setMessages(newMessages);

    try {
      const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repo_id: repoId,
          message: userMessage,
          conversation_history: newMessages.filter(msg => !msg.isUser).slice(-5).map(msg => ({
            role: msg.isUser ? 'user' : 'assistant',
            content: msg.message
          }))
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setMessages(prev => [...prev, {
          message: data.response,
          isUser: false,
          sources: data.sources
        }]);
      } else {
        throw new Error('Failed to send message');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [...prev, {
        message: '❌ Sorry, I encountered an error. Please try again.',
        isUser: false,
        sources: []
      }]);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="cyber-override" style={{ minHeight: '100vh' }}>
      {/* Header */}
      <header className="cyber-card app-header" style={{ padding: '1.5rem', margin: '1rem', marginBottom: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ 
            padding: '0.75rem', 
            background: 'linear-gradient(135deg, var(--primary), var(--accent))', 
            borderRadius: '0.5rem' 
          }}>
            <Terminal size={24} style={{ color: 'white' }} />
          </div>
          <div>
            <h1 className="gradient-text" style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>
              Talk to Your Repo
            </h1>
            <p style={{ color: 'var(--dark-text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.875rem' }}>
              AI-powered code conversation interface
            </p>
          </div>
        </div>
      </header>

      {/* URL Input Section */}
      {!repoId && (
        <div className="cyber-card" style={{ padding: '1.5rem', margin: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <Github size={20} style={{ color: 'var(--primary)' }} />
            <h2 style={{ fontSize: '1.125rem', fontWeight: '600' }}>Repository URL</h2>
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <input
              type="text"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/user/repository"
              className="cyber-input"
              style={{ flex: 1 }}
              onKeyPress={(e) => e.key === 'Enter' && processRepo()}
            />
            <button
              onClick={processRepo}
              disabled={isLoading || !repoUrl.trim()}
              className="cyber-btn cyber-btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              {isLoading ? (
                <>
                  <div className="spinner" />
                  Processing
                </>
              ) : (
                <>
                  <Zap size={16} />
                  Analyze
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Status Badge */}
      {repoStatus && (
        <div style={{ margin: '0 1rem 1rem' }}>
          <div className={`${
            repoStatus.status === 'processing' ? 'status-processing' :
            repoStatus.status === 'ready' ? 'status-ready' :
            'status-failed'
          }`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            {repoStatus.status === 'processing' && <div className="spinner" />}
            {repoStatus.status === 'ready' && <Check size={16} />}
            {repoStatus.status === 'failed' && <Zap size={16} />}
            {repoStatus.status} - {repoStatus.file_count} files, {repoStatus.processed_chunks} chunks
          </div>
        </div>
      )}

      {/* Main Interface */}
      {repoId && (
        <div style={{ display: 'flex', gap: '1rem', margin: '0 1rem', height: 'calc(100vh - 200px)' }}>
          {/* File Tree Sidebar */}
          <div className="cyber-card" style={{ padding: '1rem', width: '320px', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <FileCode size={20} style={{ color: 'var(--primary)' }} />
              <h3 style={{ fontWeight: '600' }}>File Explorer</h3>
            </div>
            <FileTree files={files} onFileSelect={(path) => console.log('Selected:', path)} />
          </div>

          {/* Chat Interface */}
          <div className="cyber-card" style={{ padding: '1.5rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <MessageSquare size={20} style={{ color: 'var(--primary)' }} />
              <h3 style={{ fontWeight: '600' }}>Chat Interface</h3>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', marginBottom: '1rem' }}>
              {messages.map((msg, index) => (
                <Message
                  key={index}
                  message={msg.message}
                  isUser={msg.isUser}
                  sources={msg.sources}
                />
              ))}
              {isSending && (
                <div className="cyber-card message-bot" style={{ padding: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ padding: '0.5rem', borderRadius: '0.5rem', background: 'rgba(0, 212, 255, 0.2)' }}>
                      <Brain size={16} style={{ color: 'var(--primary)' }} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div className="spinner" />
                      <span style={{ color: 'var(--dark-text-muted)' }}>Thinking...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div style={{ display: 'flex', gap: '1rem' }}>
              <textarea
                value={currentMessage}
                onChange={(e) => setCurrentMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={repoStatus?.status === 'ready' ? "Ask about the codebase..." : "Repository is processing..."}
                className="cyber-input"
                style={{ flex: 1, minHeight: '60px', resize: 'none', fontFamily: 'var(--font-mono)' }}
                disabled={repoStatus?.status !== 'ready' || isSending}
                rows={2}
              />
              <button
                onClick={sendMessage}
                disabled={!currentMessage.trim() || repoStatus?.status !== 'ready' || isSending}
                className="cyber-btn cyber-btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', height: 'fit-content' }}
              >
                <Send size={16} />
                Send
              </button>
            </div>

            {/* Quick Actions */}
            <div style={{ marginTop: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {[
                "Explain the main architecture",
                "Find security vulnerabilities", 
                "Show me the entry point",
                "Generate tests for core functions"
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => setCurrentMessage(suggestion)}
                  className="quick-action-btn"
                  disabled={repoStatus?.status !== 'ready'}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TalkToRepoApp;