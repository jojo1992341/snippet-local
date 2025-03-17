// Utilities
const commandHandlers = {
  'paste': async () => {
    try {
      return await navigator.clipboard.readText();
    } catch (error) {
      console.error('Failed to read clipboard:', error);
      return '';
    }
  },
  'wait': async (duration) => {
    await new Promise(resolve => setTimeout(resolve, parseInt(duration) * 1000));
    return '';
  },
  'enter': async (_, element) => {
    dispatchKeyEvent(element, 'Enter');
    return '\n';
  },
  'tab': async (_, element) => {
    dispatchKeyEvent(element, 'Tab');
    return '\t';
  },
  'date': (format) => {
    return formatDate(format || 'DD/MM/YYYY');
  },
  'time': () => {
    return new Date().toLocaleTimeString();
  },
  'uppercase': (text) => text.toUpperCase(),
  'lowercase': (text) => text.toLowerCase(),
  'capitalize': (text) => text.charAt(0).toUpperCase() + text.slice(1).toLowerCase(),
  'cursor': () => '|', // Placeholder for cursor position
  'ai': async (prompt) => {
    try {
      const config = await getAIConfig();
      if (!config.selectedProvider || !config[`${config.selectedProvider}ApiKey`]) {
        return '[Erreur: Configuration IA non définie. Veuillez configurer une clé API dans les paramètres.]';
      }
      return await generateAIResponse(prompt, config);
    } catch (error) {
      console.error('Error generating AI response:', error);
      return '[Erreur: Impossible de générer une réponse IA. Veuillez réessayer.]';
    }
  }
};

async function getAIConfig() {
  const result = await chrome.storage.local.get([
    'selectedProvider',
    'openaiApiKey',
    'claudeApiKey',
    'deepseekApiKey'
  ]);
  return result;
}

async function generateAIResponse(prompt, config) {
  const { selectedProvider } = config;

  switch (selectedProvider) {
    case 'openai':
      return await generateOpenAIResponse(prompt, config.openaiApiKey);
    case 'claude':
      return await generateClaudeResponse(prompt, config.claudeApiKey);
    case 'deepseek':
      return await generateDeepseekResponse(prompt, config.deepseekApiKey);
    default:
      throw new Error('Provider IA non supporté');
  }
}

async function generateOpenAIResponse(prompt, apiKey) {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API Error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content.trim();
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    throw error;
  }
}

async function generateClaudeResponse(prompt, apiKey) {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-3-opus-20240229',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      throw new Error(`Claude API Error: ${response.status}`);
    }

    const data = await response.json();
    return data.content[0].text;
  } catch (error) {
    console.error('Error calling Claude API:', error);
    throw error;
  }
}

async function generateDeepseekResponse(prompt, apiKey) {
  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      throw new Error(`Deepseek API Error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content.trim();
  } catch (error) {
    console.error('Error calling Deepseek API:', error);
    throw error;
  }
}

function formatDate(format) {
  const date = new Date();
  const replacements = {
    'DD': String(date.getDate()).padStart(2, '0'),
    'MM': String(date.getMonth() + 1).padStart(2, '0'),
    'YYYY': date.getFullYear(),
    'HH': String(date.getHours()).padStart(2, '0'),
    'mm': String(date.getMinutes()).padStart(2, '0'),
    'ss': String(date.getSeconds()).padStart(2, '0')
  };
  
  return format.replace(/DD|MM|YYYY|HH|mm|ss/g, match => replacements[match]);
}

function dispatchKeyEvent(element, key) {
  const event = new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    key,
    code: key,
    keyCode: key === 'Enter' ? 13 : 9,
    which: key === 'Enter' ? 13 : 9,
    shiftKey: false,
    ctrlKey: false,
    metaKey: false
  });
  element.dispatchEvent(event);
}

// State management
let snippets = [];
let customVariables = {};
let isProcessing = false;

// Initialize snippets and variables from storage
chrome.storage.local.get(['snippets', 'customVariables'], (result) => {
  snippets = result.snippets || [];
  customVariables = result.customVariables || {};
});

// Listen for storage changes
chrome.storage.onChanged.addListener((changes) => {
  if (changes.snippets) {
    snippets = changes.snippets.newValue || [];
  }
  if (changes.customVariables) {
    customVariables = changes.customVariables.newValue || {};
  }
});

// Process template with variables and dynamic inputs
async function processTemplate(template) {
  let processedText = template;
  
  // First, process all square bracket commands (priority)
  processedText = await processPlaceholders(processedText, /\[([^:[\]]+):([^[\]]+)\]/g);
  
  // Next, replace custom variables
  processedText = processedText.replace(/\{([^:{}]+)\}/g, (match, varName) => {
    return customVariables[varName] || match;
  });
  
  // Then, handle curly brace prompts
  processedText = await processPlaceholders(processedText, /\{([^:{}]+):([^{}]+)\}/g);
  
  return processedText;
}

// Function to process placeholders with a given regex pattern
async function processPlaceholders(text, regex) {
  let result = text;
  let match;
  let processed = new Set();
  
  // First pass: identify nested placeholders and process them in order
  const placeholders = [];
  const regex1 = new RegExp(regex);
  while ((match = regex1.exec(result)) !== null) {
    placeholders.push({
      fullMatch: match[0],
      key: match[1],
      promptText: match[2],
      index: match.index
    });
  }
  
  // Sort by position to ensure correct processing order
  placeholders.sort((a, b) => a.index - b.index);
  
  // Process each placeholder
  for (const placeholder of placeholders) {
    if (processed.has(placeholder.fullMatch)) continue;
    
    let value;
    // Check if this is a command
    if (commandHandlers[placeholder.key.toLowerCase()]) {
      value = await commandHandlers[placeholder.key.toLowerCase()](placeholder.promptText);
    } else {
      // Otherwise treat it as a user prompt
      value = prompt(placeholder.promptText) || placeholder.fullMatch;
    }
    
    // Handle nested placeholders in the prompt result
    if (regex.test(value)) {
      value = await processPlaceholders(value, regex);
    }
    
    result = result.replace(placeholder.fullMatch, value);
    processed.add(placeholder.fullMatch);
  }
  
  return result;
}

async function executeCommand(command, element) {
  // Check for square bracket format (priority)
  let match = command.match(/\[([^:[\]]+)(?::([^[\]]+))?\]/);
  if (!match) {
    // Check for curly brace format
    match = command.match(/\{([^:{}]+)(?::([^{}]+))?\}/);
    if (!match) return command;
  }

  const [fullMatch, cmd, args] = match;
  const handler = commandHandlers[cmd.toLowerCase()];

  if (handler) {
    try {
      const result = await handler(args, element);
      return command.replace(fullMatch, result);
    } catch (error) {
      console.error(`Error executing command ${cmd}:`, error);
      return command;
    }
  }

  // If no handler found, try processing as a template
  return processTemplate(command);
}

// Debounce function
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Monitor input fields
document.addEventListener('input', debounce((e) => {
  const target = e.target;
  if (isProcessing || !isEditableElement(target)) return;
  
  const text = getElementText(target);
  checkForSnippets(target, text);
}, 50));

function isEditableElement(element) {
  if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
    return true;
  }

  if (element.isContentEditable) {
    return true;
  }

  if (element.tagName === 'IFRAME' && element.contentDocument) {
    const body = element.contentDocument.body;
    return body && body.contentEditable === 'true';
  }

  if (element.ownerDocument && element.ownerDocument.designMode === 'on') {
    return true;
  }

  return false;
}

function getElementText(element) {
  if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
    return element.value;
  }

  if (element.tagName === 'IFRAME') {
    try {
      const doc = element.contentDocument;
      if (doc && doc.body) {
        return doc.body.textContent || doc.body.innerText;
      }
    } catch (e) {
      console.warn('Cannot access iframe content:', e);
    }
    return '';
  }

  return element.textContent || element.innerText || '';
}

async function replaceSnippet(element, snippet) {
  if (isProcessing) return;
  isProcessing = true;

  try {
    const text = getElementText(element);
    const startPos = text.length - snippet.shortcut.length;
    const beforeShortcut = text.slice(0, startPos);
    
    // Split the text into parts and process commands sequentially
    const placeholderRegex = /(\{[^{}]+\}|\[[^\[\]]+\])/;
    const parts = snippet.text.split(placeholderRegex);
    
    let currentText = beforeShortcut;
    let cursorPosition = -1;
    
    // Process each part sequentially
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      
      if ((part.startsWith('{') && part.endsWith('}')) || (part.startsWith('[') && part.endsWith(']'))) {
        // Process command
        if (part === '{cursor}' || part === '[cursor]') {
          cursorPosition = currentText.length;
          continue;
        }
        
        const result = await executeCommand(part, element);
        currentText += result;
      } else {
        // Add regular text
        currentText += part;
      }
      
      // Update the element with the current text
      if (element.tagName === 'IFRAME') {
        try {
          const doc = element.contentDocument;
          if (doc && doc.body) {
            await insertIntoIframe(doc, '', currentText, cursorPosition);
          }
        } catch (e) {
          console.warn('Cannot access iframe content:', e);
        }
      } else if (element.isContentEditable || element.ownerDocument.designMode === 'on') {
        await insertIntoRichEditor(element, '', currentText, cursorPosition);
      } else {
        await insertIntoInput(element, '', currentText, cursorPosition);
      }
      
      // Trigger events after each update
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    }
    
    // Final update to ensure cursor position is correct
    if (cursorPosition !== -1) {
      if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
        element.selectionStart = element.selectionEnd = cursorPosition;
      } else if (element.isContentEditable) {
        const selection = window.getSelection();
        const range = document.createRange();
        const textNodes = [];
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        let node;
        while (node = walker.nextNode()) {
          textNodes.push(node);
        }
        
        let currentPos = 0;
        for (const node of textNodes) {
          if (currentPos + node.length >= cursorPosition) {
            range.setStart(node, cursorPosition - currentPos);
            range.setEnd(node, cursorPosition - currentPos);
            selection.removeAllRanges();
            selection.addRange(range);
            break;
          }
          currentPos += node.length;
        }
      }
    }
    
  } catch (error) {
    console.error('Error replacing snippet:', error);
  } finally {
    isProcessing = false;
  }
}

async function insertIntoInput(element, beforeText, newText, cursorPosition) {
  element.value = beforeText + newText;
  if (cursorPosition !== -1) {
    element.selectionStart = element.selectionEnd = beforeText.length + cursorPosition;
  } else {
    element.selectionStart = element.selectionEnd = (beforeText + newText).length;
  }
}

async function insertIntoRichEditor(element, beforeText, newText, cursorPosition) {
  const selection = window.getSelection();
  const range = document.createRange();
  
  element.innerHTML = beforeText;
  
  const temp = document.createElement('div');
  temp.innerHTML = newText;
  
  range.selectNodeContents(element);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
  
  document.execCommand('insertHTML', false, newText);

  if (cursorPosition !== -1) {
    const textNodes = [];
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node;
      while (node = walker.nextNode()) {
      textNodes.push(node);
    }
    
    let currentPos = 0;
    for (const node of textNodes) {
      if (currentPos + node.length >= cursorPosition) {
        range.setStart(node, cursorPosition - currentPos);
        range.setEnd(node, cursorPosition - currentPos);
        selection.removeAllRanges();
        selection.addRange(range);
        break;
      }
      currentPos += node.length;
    }
  }
}

async function insertIntoIframe(doc, beforeText, newText, cursorPosition) {
  const body = doc.body;
  if (!body) return;

  if (body.innerHTML !== undefined) {
    body.innerHTML = beforeText;
    const selection = doc.getSelection();
    const range = doc.createRange();
    range.selectNodeContents(body);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
    
    doc.execCommand('insertHTML', false, newText);

    if (cursorPosition !== -1) {
      const textNodes = [];
      const walker = doc.createTreeWalker(body, NodeFilter.SHOW_TEXT);
      let node;
      while (node = walker.nextNode()) {
        textNodes.push(node);
      }
      
      let currentPos = 0;
      for (const node of textNodes) {
        if (currentPos + node.length >= cursorPosition) {
          range.setStart(node, cursorPosition - currentPos);
          range.setEnd(node, cursorPosition - currentPos);
          selection.removeAllRanges();
          selection.addRange(range);
          break;
        }
        currentPos += node.length;
      }
    }
  } else {
    body.textContent = beforeText + newText;
  }
}

function checkForSnippets(target, text) {
  for (const snippet of snippets) {
    if (text.endsWith(snippet.shortcut)) {
      replaceSnippet(target, snippet);
      break;
    }
  }
}

// Fonction pour importer des snippets avec gestion des conflits
async function importSnippets(newSnippets) {
  // Récupérer les snippets existants
  const { snippets: existingSnippets = [] } = await chrome.storage.local.get(['snippets']);
  
  // Vérifier les conflits
  const conflicts = [];
  const nonConflicting = [];
  
  for (const newSnippet of newSnippets) {
    const existingSnippet = existingSnippets.find(s => s.shortcut === newSnippet.shortcut);
    
    if (existingSnippet) {
      conflicts.push({
        existing: existingSnippet,
        new: newSnippet
      });
    } else {
      nonConflicting.push(newSnippet);
    }
  }
  
  // S'il n'y a pas de conflits, importer directement
  if (conflicts.length === 0) {
    await chrome.storage.local.set({ 
      snippets: [...existingSnippets, ...nonConflicting] 
    });
    return { success: true, imported: newSnippets.length, conflicts: 0 };
  }
  
  // Traiter les conflits un par un
  const resolvedSnippets = [...nonConflicting];
  
  for (const conflict of conflicts) {
    const response = await showConflictDialog(conflict.existing, conflict.new);
    
    if (response === 'keep-existing') {
      // Garder l'existant (ne rien faire)
    } else if (response === 'keep-new') {
      // Remplacer par le nouveau
      const index = existingSnippets.findIndex(s => s.shortcut === conflict.existing.shortcut);
      if (index !== -1) {
        existingSnippets[index] = conflict.new;
      }
      resolvedSnippets.push(conflict.new);
    } else if (response === 'keep-both') {
      // Modifier le raccourci du nouveau snippet pour éviter le conflit
      const modifiedSnippet = { ...conflict.new };
      modifiedSnippet.shortcut = await modifyShortcut(modifiedSnippet.shortcut);
      resolvedSnippets.push(modifiedSnippet);
    }
  }
  
  // Mettre à jour le stockage avec les résultats
  const updatedSnippets = [...existingSnippets.filter(s => 
    !conflicts.some(c => c.existing.shortcut === s.shortcut)
  ), ...resolvedSnippets];
  
  await chrome.storage.local.set({ snippets: updatedSnippets });
  
  return { 
    success: true, 
    imported: resolvedSnippets.length, 
    conflicts: conflicts.length 
  };
}

// Fonction pour afficher un dialogue de résolution de conflit
function showConflictDialog(existingSnippet, newSnippet) {
  return new Promise((resolve) => {
    // Créer un dialogue modal
    const modal = document.createElement('div');
    modal.className = 'snippet-conflict-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
    `;
    
    const content = document.createElement('div');
    content.style.cssText = `
      background: white;
      padding: 20px;
      border-radius: 8px;
      max-width: 600px;
      width: 80%;
      max-height: 80vh;
      overflow-y: auto;
    `;
    
    content.innerHTML = `
      <h2 style="margin-top: 0;">Conflit de raccourci</h2>
      <p>Le raccourci <strong>${existingSnippet.shortcut}</strong> existe déjà.</p>
      
      <div style="margin: 15px 0; padding: 10px; border: 1px solid #ddd; border-radius: 4px;">
        <h3 style="margin-top: 0;">Snippet existant</h3>
        <div><strong>Raccourci:</strong> ${existingSnippet.shortcut}</div>
        <div><strong>Contenu:</strong> <pre style="white-space: pre-wrap; background: #f5f5f5; padding: 8px;">${existingSnippet.text}</pre></div>
      </div>
      
      <div style="margin: 15px 0; padding: 10px; border: 1px solid #ddd; border-radius: 4px;">
        <h3 style="margin-top: 0;">Nouveau snippet</h3>
        <div><strong>Raccourci:</strong> ${newSnippet.shortcut}</div>
        <div><strong>Contenu:</strong> <pre style="white-space: pre-wrap; background: #f5f5f5; padding: 8px;">${newSnippet.text}</pre></div>
      </div>
      
      <div style="display: flex; justify-content: space-between; margin-top: 20px;">
        <button class="keep-existing" style="padding: 8px 16px;">Garder l'existant</button>
        <button class="keep-new" style="padding: 8px 16px;">Remplacer par le nouveau</button>
        <button class="keep-both" style="padding: 8px 16px;">Garder les deux (modifier le raccourci)</button>
      </div>
    `;
    
    modal.appendChild(content);
    document.body.appendChild(modal);
    
    // Ajouter les gestionnaires d'événements
    modal.querySelector('.keep-existing').addEventListener('click', () => {
      document.body.removeChild(modal);
      resolve('keep-existing');
    });
    
    modal.querySelector('.keep-new').addEventListener('click', () => {
      document.body.removeChild(modal);
      resolve('keep-new');
    });
    
    modal.querySelector('.keep-both').addEventListener('click', () => {
      document.body.removeChild(modal);
      resolve('keep-both');
    });
  });
}

// Fonction pour modifier le raccourci (ajouter un suffixe numérique)
async function modifyShortcut(shortcut) {
  // Obtenir les snippets existants pour vérifier que le nouveau raccourci n'existe pas déjà
  const { snippets = [] } = await chrome.storage.local.get(['snippets']);
  
  // Fonction pour vérifier si un raccourci existe déjà
  const shortcutExists = (sc) => snippets.some(s => s.shortcut === sc);
  
  // Ajouter un suffixe numérique jusqu'à trouver un raccourci unique
  let counter = 1;
  let newShortcut = `${shortcut}_${counter}`;
  
  while (shortcutExists(newShortcut)) {
    counter++;
    newShortcut = `${shortcut}_${counter}`;
  }
  
  return newShortcut;
}

// Fonction pour demander la confirmation de modifier le raccourci
async function promptForNewShortcut(shortcut) {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.className = 'snippet-shortcut-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
    `;
    
    const content = document.createElement('div');
    content.style.cssText = `
      background: white;
      padding: 20px;
      border-radius: 8px;
      max-width: 400px;
      width: 80%;
    `;
    
    content.innerHTML = `
      <h2 style="margin-top: 0;">Modifier le raccourci</h2>
      <p>Le raccourci <strong>${shortcut}</strong> existe déjà. Veuillez entrer un nouveau raccourci :</p>
      
      <input type="text" id="new-shortcut" value="${shortcut}_new" style="width: 100%; padding: 8px; margin: 10px 0;">
      
      <div style="display: flex; justify-content: space-between; margin-top: 20px;">
        <button class="cancel" style="padding: 8px 16px;">Annuler</button>
        <button class="confirm" style="padding: 8px 16px;">Confirmer</button>
      </div>
    `;
    
    modal.appendChild(content);
    document.body.appendChild(modal);
    
    const input = modal.querySelector('#new-shortcut');
    input.focus();
    input.select();
    
    modal.querySelector('.cancel').addEventListener('click', () => {
      document.body.removeChild(modal);
      resolve(null);
    });
    
    modal.querySelector('.confirm').addEventListener('click', () => {
      const newShortcut = input.value.trim();
      document.body.removeChild(modal);
      resolve(newShortcut);
    });
    
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const newShortcut = input.value.trim();
        document.body.removeChild(modal);
        resolve(newShortcut);
      }
    });
  });
}

// Exemple d'utilisation dans le contexte de l'importation de snippets
async function handleImportSnippets(event) {
  try {
    const fileInput = event.target;
    const file = fileInput.files[0];
    
    if (!file) return;
    
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const importedSnippets = JSON.parse(e.target.result);
        
        if (!Array.isArray(importedSnippets)) {
          throw new Error('Format de fichier invalide');
        }
        
        const result = await importSnippets(importedSnippets);
        
        // Afficher un message de succès
        showNotification(`Importation réussie: ${result.imported} snippets importés, ${result.conflicts} conflits résolus.`);
        
        // Réinitialiser l'élément input pour permettre une nouvelle importation
        fileInput.value = '';
      } catch (error) {
        console.error('Erreur lors de l\'importation:', error);
        showNotification(`Erreur lors de l'importation: ${error.message}`, 'error');
      }
    };
    
    reader.readAsText(file);
  } catch (error) {
    console.error('Erreur lors de la lecture du fichier:', error);
    showNotification(`Erreur lors de la lecture du fichier: ${error.message}`, 'error');
  }
}

// Fonction utilitaire pour afficher des notifications
function showNotification(message, type = 'success') {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    padding: 12px 20px;
    background-color: ${type === 'success' ? '#4CAF50' : '#f44336'};
    color: white;
    border-radius: 4px;
    z-index: 10000;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
  `;
  
  notification.textContent = message;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.opacity = '0';
    notification.style.transition = 'opacity 0.5s ease';
    
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 500);
  }, 3000);
}

// Fonction pour importer des variables avec gestion des conflits
async function importVariables(newVariables) {
  // Récupérer les variables existantes
  const { customVariables: existingVariables = {} } = await chrome.storage.local.get(['customVariables']);
  
  // Vérifier les conflits
  const conflicts = [];
  const nonConflicting = {};
  
  for (const [key, value] of Object.entries(newVariables)) {
    if (existingVariables.hasOwnProperty(key)) {
      conflicts.push({
        varName: key,
        existing: existingVariables[key],
        new: value
      });
    } else {
      nonConflicting[key] = value;
    }
  }
  
  // S'il n'y a pas de conflits, importer directement
  if (conflicts.length === 0) {
    await chrome.storage.local.set({ 
      customVariables: { ...existingVariables, ...nonConflicting } 
    });
    return { success: true, imported: Object.keys(newVariables).length, conflicts: 0 };
  }
  
  // Traiter les conflits un par un
  const resolvedVariables = { ...nonConflicting };
  
  for (const conflict of conflicts) {
    const response = await showVariableConflictDialog(conflict.varName, conflict.existing, conflict.new);
    
    if (response.action === 'keep-existing') {
      // Garder l'existant (ne rien faire)
    } else if (response.action === 'keep-new') {
      // Remplacer par le nouveau
      resolvedVariables[conflict.varName] = conflict.new;
    } else if (response.action === 'keep-both') {
      // Modifier le nom de la nouvelle variable pour éviter le conflit
      resolvedVariables[response.newName] = conflict.new;
    }
  }
  
  // Mettre à jour le stockage avec les résultats
  const updatedVariables = { ...existingVariables };
  
  // Appliquer les modifications des variables en conflit
  for (const conflict of conflicts) {
    if (resolvedVariables.hasOwnProperty(conflict.varName)) {
      updatedVariables[conflict.varName] = resolvedVariables[conflict.varName];
      delete resolvedVariables[conflict.varName]; // Pour éviter de l'ajouter deux fois
    }
  }
  
  // Ajouter toutes les variables non conflictuelles et renommées
  const finalVariables = { ...updatedVariables, ...resolvedVariables };
  
  await chrome.storage.local.set({ customVariables: finalVariables });
  
  return { 
    success: true, 
    imported: Object.keys(resolvedVariables).length, 
    conflicts: conflicts.length 
  };
}

// Fonction pour afficher un dialogue de résolution de conflit pour les variables
function showVariableConflictDialog(varName, existingValue, newValue) {
  return new Promise((resolve) => {
    // Créer un dialogue modal
    const modal = document.createElement('div');
    modal.className = 'variable-conflict-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
    `;
    
    const content = document.createElement('div');
    content.style.cssText = `
      background: white;
      padding: 20px;
      border-radius: 8px;
      max-width: 600px;
      width: 80%;
      max-height: 80vh;
      overflow-y: auto;
    `;
    
    content.innerHTML = `
      <h2 style="margin-top: 0;">Conflit de variable</h2>
      <p>La variable <strong>${varName}</strong> existe déjà.</p>
      
      <div style="margin: 15px 0; padding: 10px; border: 1px solid #ddd; border-radius: 4px;">
        <h3 style="margin-top: 0;">Variable existante</h3>
        <div><strong>Nom:</strong> ${varName}</div>
        <div><strong>Valeur:</strong> <pre style="white-space: pre-wrap; background: #f5f5f5; padding: 8px;">${existingValue}</pre></div>
      </div>
      
      <div style="margin: 15px 0; padding: 10px; border: 1px solid #ddd; border-radius: 4px;">
        <h3 style="margin-top: 0;">Nouvelle variable</h3>
        <div><strong>Nom:</strong> ${varName}</div>
        <div><strong>Valeur:</strong> <pre style="white-space: pre-wrap; background: #f5f5f5; padding: 8px;">${newValue}</pre></div>
      </div>
      
      <div style="display: flex; justify-content: space-between; margin-top: 20px;">
        <button class="keep-existing" style="padding: 8px 16px;">Garder l'existante</button>
        <button class="keep-new" style="padding: 8px 16px;">Remplacer par la nouvelle</button>
        <button class="keep-both" style="padding: 8px 16px;">Garder les deux (renommer)</button>
      </div>
      
      <div class="rename-section" style="margin-top: 15px; display: none;">
        <p>Nouveau nom pour la variable importée:</p>
        <input type="text" id="new-var-name" value="${varName}_new" style="width: 100%; padding: 8px;">
        <button class="confirm-rename" style="margin-top: 10px; padding: 8px 16px;">Confirmer</button>
      </div>
    `;
    
    modal.appendChild(content);
    document.body.appendChild(modal);
    
    // Sections et éléments du dialogue
    const renameSection = modal.querySelector('.rename-section');
    const newVarNameInput = modal.querySelector('#new-var-name');
    
    // Ajouter les gestionnaires d'événements
    modal.querySelector('.keep-existing').addEventListener('click', () => {
      document.body.removeChild(modal);
      resolve({ action: 'keep-existing' });
    });
    
    modal.querySelector('.keep-new').addEventListener('click', () => {
      document.body.removeChild(modal);
      resolve({ action: 'keep-new' });
    });
    
    modal.querySelector('.keep-both').addEventListener('click', () => {
      renameSection.style.display = 'block';
      newVarNameInput.focus();
      newVarNameInput.select();
    });
    
    modal.querySelector('.confirm-rename').addEventListener('click', () => {
      const newName = newVarNameInput.value.trim();
      if (newName && newName !== varName) {
        document.body.removeChild(modal);
        resolve({ action: 'keep-both', newName });
      } else {
        // Afficher un message d'erreur si le nom est vide ou identique
        alert('Veuillez entrer un nom différent pour la variable.');
      }
    });
    
    // Gestion de l'appui sur Entrée dans le champ de texte
    newVarNameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const newName = newVarNameInput.value.trim();
        if (newName && newName !== varName) {
          document.body.removeChild(modal);
          resolve({ action: 'keep-both', newName });
        } else {
          alert('Veuillez entrer un nom différent pour la variable.');
        }
      }
    });
  });
}

// Fonction pour vérifier si un nom de variable existe déjà
async function variableNameExists(name) {
  const { customVariables = {} } = await chrome.storage.local.get(['customVariables']);
  return customVariables.hasOwnProperty(name);
}

// Exemple de fonction pour gérer l'importation des variables
async function handleImportVariables(event) {
  try {
    const fileInput = event.target;
    const file = fileInput.files[0];
    
    if (!file) return;
    
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const importedVariables = JSON.parse(e.target.result);
        
        if (typeof importedVariables !== 'object' || importedVariables === null || Array.isArray(importedVariables)) {
          throw new Error('Format de fichier invalide. Un objet JSON est attendu.');
        }
        
        const result = await importVariables(importedVariables);
        
        // Afficher un message de succès
        showNotification(`Importation réussie: ${result.imported} variables importées, ${result.conflicts} conflits résolus.`);
        
        // Réinitialiser l'élément input pour permettre une nouvelle importation
        fileInput.value = '';
      } catch (error) {
        console.error('Erreur lors de l\'importation des variables:', error);
        showNotification(`Erreur lors de l'importation: ${error.message}`, 'error');
      }
    };
    
    reader.readAsText(file);
  } catch (error) {
    console.error('Erreur lors de la lecture du fichier:', error);
    showNotification(`Erreur lors de la lecture du fichier: ${error.message}`, 'error');
  }
}