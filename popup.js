import { 
  getSnippets, 
  saveSnippet, 
  deleteSnippet, 
  getCategories, 
  saveCategory,
  handleImportSnippets
} from './storage.js';

let currentTheme = 'light';
let snippetsCache = [];
let categoriesCache = [];

function showDialog({ title, message, input, showInput, placeholder, showCopy, onConfirm }) {
  const dialog = document.createElement('div');
  dialog.className = 'dialog-overlay';
  dialog.innerHTML = `
    <div class="dialog">
      <h2>${title}</h2>
      ${message ? `<p class="dialog-message">${message}</p>` : ''}
      ${input ? `
        <input type="text" class="dialog-input" value="${input}" readonly>
        ${showCopy ? `<button class="btn secondary" id="copyBtn">Copier le lien</button>` : ''}
      ` : ''}
      ${showInput ? `
        <input type="text" class="dialog-input" placeholder="${placeholder || ''}" id="dialogInput">
      ` : ''}
      <div class="dialog-buttons">
        <button class="btn secondary" id="dialogCancelBtn">Fermer</button>
        ${onConfirm ? `<button class="btn primary" id="dialogConfirmBtn">Configurer</button>` : ''}
      </div>
    </div>
  `;

  document.body.appendChild(dialog);

  const closeDialog = () => dialog.remove();

  if (showCopy && dialog.querySelector('#copyBtn')) {
    dialog.querySelector('#copyBtn').addEventListener('click', () => {
      navigator.clipboard.writeText(input);
      showSuccess('Lien copié dans le presse-papiers');
    });
  }

  const cancelBtn = dialog.querySelector('#dialogCancelBtn');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', closeDialog);
  }

  const confirmBtn = dialog.querySelector('#dialogConfirmBtn');
  if (confirmBtn && onConfirm) {
    confirmBtn.addEventListener('click', () => {
      const inputElement = dialog.querySelector('#dialogInput');
      if (inputElement) {
        const value = inputElement.value.trim();
        if (value) {
          onConfirm(value);
          closeDialog();
        }
      } else {
        onConfirm();
        closeDialog();
      }
    });
  }

  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) closeDialog();
  });

  return dialog;
}

document.addEventListener('DOMContentLoaded', async () => {
  initializeTheme();
  await Promise.all([
    loadCategories(),
    loadSnippets()
  ]);
  setupEventListeners();
});

function initializeTheme() {
  const savedTheme = localStorage.getItem('theme') || 'light';
  setTheme(savedTheme);
}

function setTheme(theme) {
  currentTheme = theme;
  document.body.setAttribute('data-theme', theme);
  const toggleThemeBtn = document.getElementById('toggleTheme');
  if (toggleThemeBtn) {
    toggleThemeBtn.textContent = theme === 'light' ? '🌙' : '☀️';
  }
  localStorage.setItem('theme', theme);
}

async function loadCategories() {
  try {
    categoriesCache = await getCategories();
    const select = document.getElementById('categorySelect');
    select.innerHTML = '<option value="">Toutes les catégories</option>';
    
    categoriesCache.forEach(category => {
      const option = document.createElement('option');
      option.value = category;
      option.textContent = category;
      select.appendChild(option);
    });
  } catch (error) {
    console.error('Error loading categories:', error);
    showError('Erreur lors du chargement des catégories');
  }
}

async function loadSnippets() {
  try {
    snippetsCache = await getSnippets();
    const selectedCategory = document.getElementById('categorySelect').value;
    const snippetList = document.getElementById('snippetList');
    snippetList.innerHTML = '';

    const filteredSnippets = selectedCategory 
      ? snippetsCache.filter(s => s.category === selectedCategory)
      : snippetsCache;

    if (filteredSnippets.length === 0) {
      snippetList.innerHTML = '<div class="empty-state">Aucun snippet trouvé</div>';
      return;
    }

    filteredSnippets.forEach(snippet => {
      const item = createSnippetElement(snippet);
      snippetList.appendChild(item);
    });
  } catch (error) {
    console.error('Error loading snippets:', error);
    showError('Erreur lors du chargement des snippets');
  }
}

function createSnippetElement(snippet) {
  const div = document.createElement('div');
  div.className = 'snippet-item';
  div.innerHTML = `
    <div class="snippet-content">
      <div class="snippet-header">
        <strong class="snippet-shortcut">${snippet.shortcut}</strong>
        ${snippet.category ? `<span class="snippet-category">${snippet.category}</span>` : ''}
      </div>
      <p class="snippet-text">${snippet.text.substring(0, 50)}${snippet.text.length > 50 ? '...' : ''}</p>
    </div>
    <div class="snippet-actions">
      <button class="btn icon-btn edit-btn" data-id="${snippet.id}" title="Modifier">✏️</button>
      <button class="btn icon-btn delete-btn" data-id="${snippet.id}" title="Supprimer">🗑️</button>
    </div>
  `;

  div.querySelector('.edit-btn').addEventListener('click', () => editSnippet(snippet.id));
  div.querySelector('.delete-btn').addEventListener('click', () => deleteSnippetHandler(snippet.id));
  return div;
}

function setupEventListeners() {
  document.getElementById('toggleTheme').addEventListener('click', () => {
    setTheme(currentTheme === 'light' ? 'dark' : 'light');
  });

  document.getElementById('categorySelect').addEventListener('change', loadSnippets);

  document.getElementById('addCategory').addEventListener('click', async () => {
    const category = prompt('Nom de la nouvelle catégorie:');
    if (category?.trim()) {
      try {
        await saveCategory(category.trim());
        await loadCategories();
        showSuccess('Catégorie ajoutée avec succès');
      } catch (error) {
        console.error('Error saving category:', error);
        showError('Erreur lors de la création de la catégorie');
      }
    }
  });

  document.getElementById('addSnippet').addEventListener('click', () => {
    showSnippetDialog();
  });

  document.getElementById('importFile').addEventListener('change', importSnippets);

  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.placeholder = 'Rechercher des snippets...';
  searchInput.className = 'search-input';
  document.querySelector('.categories').insertBefore(searchInput, document.getElementById('addCategory'));
  
  searchInput.addEventListener('input', debounce(() => {
    const searchTerm = searchInput.value.toLowerCase();
    const filteredSnippets = snippetsCache.filter(snippet => 
      snippet.shortcut.toLowerCase().includes(searchTerm) ||
      snippet.text.toLowerCase().includes(searchTerm) ||
      snippet.category?.toLowerCase().includes(searchTerm)
    );
    
    const snippetList = document.getElementById('snippetList');
    snippetList.innerHTML = '';
    
    if (filteredSnippets.length === 0) {
      snippetList.innerHTML = '<div class="empty-state">Aucun résultat trouvé</div>';
      return;
    }
    
    filteredSnippets.forEach(snippet => {
      const item = createSnippetElement(snippet);
      snippetList.appendChild(item);
    });
  }, 300));

  setupExportImportListeners();
}

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

async function showSnippetDialog(snippetId = null) {
  const snippet = snippetId ? snippetsCache.find(s => s.id === snippetId) : null;
  
  const dialog = document.createElement('div');
  dialog.className = 'dialog-overlay';
  dialog.innerHTML = `
    <div class="dialog">
      <h2>${snippet ? 'Modifier le Snippet' : 'Nouveau Snippet'}</h2>
      <form id="snippetForm">
        <div class="form-group">
          <label for="shortcut">Raccourci:</label>
          <div class="shortcut-input-container">
            <div class="shortcut-prefix">/</div>
            <input 
              type="text" 
              id="shortcut" 
              required 
              value="${snippet?.shortcut ? snippet.shortcut.substring(1) : ''}" 
              placeholder="exemple"
            />
          </div>
          <div class="help-text">Entrez le raccourci sans le "/" (ex: mail, date)</div>
        </div>
        <div class="form-group">
          <label for="text">Texte:</label>
          <textarea id="text" required>${snippet?.text || ''}</textarea>
          <div class="help-text">
            <p>Commandes disponibles:</p>
            <p><a href="#" id="openOptions" class="link-options">Cliquer ici pour accéder aux paramètres et gérer vos commandes personnalisées</a></p>
            <ul>
              <li><code>{paste}</code> - Coller le contenu du presse-papiers</li>
              <li><code>{wait:X}</code> - Attendre X secondes</li>
              <li><code>{enter}</code> - Appuyer sur la touche Entrée</li>
              <li><code>{date:format}</code> - Insérer la date (format: DD/MM/YYYY, HH:mm:ss)</li>
              <li><code>{time}</code> - Insérer l'heure actuelle</li>
              <li><code>{tab}</code> - Insérer une tabulation</li>
              <li><code>{cursor}</code> - Positionner le curseur</li>
              <li><code>{ai:prompt}</code> - Générer du texte avec l'IA (nécessite une clé API)</li>
            </ul>
          </div>
        </div>
        <div class="form-group">
          <label for="category">Catégorie:</label>
          <select id="category">
            <option value="">Aucune catégorie</option>
            ${categoriesCache.map(cat => `
              <option value="${cat}" ${snippet?.category === cat ? 'selected' : ''}>
                ${cat}
              </option>
            `).join('')}
          </select>
        </div>
        <div class="dialog-buttons">
          <button type="button" class="btn secondary" id="cancelBtn">Annuler</button>
          <button type="submit" class="btn primary">Enregistrer</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(dialog);

  const form = dialog.querySelector('#snippetForm');
  const cancelBtn = dialog.querySelector('#cancelBtn');
  const openOptionsBtn = dialog.querySelector('#openOptions');
  const shortcutInput = form.querySelector('#shortcut');

  // Empêcher le collage du "/" dans le champ de raccourci
  shortcutInput.addEventListener('paste', (e) => {
    e.preventDefault();
    const pastedText = (e.clipboardData || window.clipboardData).getData('text');
    const cleanedText = pastedText.replace(/^\/+/, ''); // Supprimer les "/" au début
    const start = shortcutInput.selectionStart;
    const end = shortcutInput.selectionEnd;
    const currentValue = shortcutInput.value;
    shortcutInput.value = currentValue.substring(0, start) + cleanedText + currentValue.substring(end);
    shortcutInput.selectionStart = shortcutInput.selectionEnd = start + cleanedText.length;
  });

  // Empêcher la saisie du "/" dans le champ de raccourci
  shortcutInput.addEventListener('keydown', (e) => {
    if (e.key === '/') {
      e.preventDefault();
    }
  });

  // Empêcher le glisser-déposer du "/"
  shortcutInput.addEventListener('drop', (e) => {
    e.preventDefault();
    const droppedText = e.dataTransfer.getData('text');
    const cleanedText = droppedText.replace(/^\/+/, '');
    const start = shortcutInput.selectionStart;
    const end = shortcutInput.selectionEnd;
    const currentValue = shortcutInput.value;
    shortcutInput.value = currentValue.substring(0, start) + cleanedText + currentValue.substring(end);
    shortcutInput.selectionStart = shortcutInput.selectionEnd = start + cleanedText.length;
  });

  openOptionsBtn.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const shortcutValue = form.shortcut.value.trim();
      if (!shortcutValue) {
        showError('Le raccourci ne peut pas être vide');
        return;
      }

      const newSnippet = {
        id: snippet?.id || crypto.randomUUID(),
        shortcut: '/' + shortcutValue, // Ajouter le "/" automatiquement
        text: form.text.value,
        category: form.category.value
      };
      
      await saveSnippet(newSnippet);
      await loadSnippets();
      dialog.remove();
      showSuccess('Snippet enregistré avec succès');
    } catch (error) {
      console.error('Error saving snippet:', error);
      showError('Erreur lors de l\'enregistrement du snippet');
    }
  });

  cancelBtn.addEventListener('click', () => {
    dialog.remove();
  });

  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) {
      dialog.remove();
    }
  });

  shortcutInput.focus();
}

// ... (garder le reste du code inchangé)

async function editSnippet(id) {
  await showSnippetDialog(id);
}

async function deleteSnippetHandler(id) {
  if (confirm('Êtes-vous sûr de vouloir supprimer ce snippet ?')) {
    try {
      await deleteSnippet(id);
      await loadSnippets();
      showSuccess('Snippet supprimé avec succès');
    } catch (error) {
      console.error('Error deleting snippet:', error);
      showError('Erreur lors de la suppression du snippet');
    }
  }
}

async function exportSnippets() {
  try {
    const snippets = await getSnippets();
    const blob = new Blob([JSON.stringify(snippets, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'snippets.json';
    a.click();
    
    URL.revokeObjectURL(url);
    showSuccess('Export réussi');
  } catch (error) {
    console.error('Error exporting snippets:', error);
    showError('Erreur lors de l\'export des snippets');
  }
}

async function importSnippets(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const snippets = JSON.parse(e.target.result);
      for (const snippet of snippets) {
        await saveSnippet(snippet);
      }
      await loadSnippets();
      showSuccess('Import réussi');
    } catch (error) {
      console.error('Error importing snippets:', error);
      showError('Erreur lors de l\'import des snippets');
    }
  };
  reader.readAsText(file);
}

function showError(message) {
  const toast = createToast(message, 'error');
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function showSuccess(message) {
  const toast = createToast(message, 'success');
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function createToast(message, type) {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  return toast;
}

function setupExportImportListeners() {
  const exportLocalBtn = document.getElementById('exportLocalBtn');
  const importLocalBtn = document.getElementById('importLocalBtn');
  const importFile = document.getElementById('importFile');

  if (exportLocalBtn) {
    exportLocalBtn.addEventListener('click', exportSnippets);
  }

  if (importLocalBtn && importFile) {
    importLocalBtn.addEventListener('click', () => {
      importFile.click();
    });
    
    importFile.addEventListener('change', async (event) => {
      try {
        const result = await handleImportSnippets(event);
        if (result.success) {
          showSuccess(`Import réussi : ${result.imported} snippets importés, ${result.conflicts} conflits résolus`);
          await loadSnippets();
        }
      } catch (error) {
        console.error('Error importing snippets:', error);
        showError('Erreur lors de l\'import des snippets');
      }
      importFile.value = '';
    });
  }
}

async function showConflictDialog(existingSnippet, newSnippet) {
  return new Promise((resolve) => {
    const dialog = document.createElement('div');
    dialog.className = 'dialog-overlay';
    dialog.innerHTML = `
      <div class="dialog">
        <h2>Conflit de raccourci</h2>
        <p>Le raccourci <strong>${existingSnippet.shortcut}</strong> existe déjà.</p>
        
        <div class="snippet-preview">
          <h3>Snippet existant</h3>
          <div class="snippet-details">
            <p><strong>Raccourci:</strong> ${existingSnippet.shortcut}</p>
            <p><strong>Texte:</strong></p>
            <pre>${existingSnippet.text}</pre>
          </div>
        </div>
        
        <div class="snippet-preview">
          <h3>Nouveau snippet</h3>
          <div class="snippet-details">
            <p><strong>Raccourci:</strong> ${newSnippet.shortcut}</p>
            <p><strong>Texte:</strong></p>
            <pre>${newSnippet.text}</pre>
          </div>
        </div>
        
        <div class="dialog-buttons">
          <button class="btn secondary" id="keepExisting">Garder l'existant</button>
          <button class="btn secondary" id="keepNew">Utiliser le nouveau</button>
        </div>
      </div>
    `;

    document.body.appendChild(dialog);

    dialog.querySelector('#keepExisting').addEventListener('click', () => {
      dialog.remove();
      resolve('keep-existing');
    });

    dialog.querySelector('#keepNew').addEventListener('click', () => {
      dialog.remove();
      resolve('keep-new');
    });

    dialog.querySelector('#keepBoth').addEventListener('click', () => {
      dialog.remove();
      resolve('keep-both');
    });

    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) {
        dialog.remove();
        resolve('keep-existing');
      }
    });
  });
}

async function modifyShortcut(shortcut) {
  let counter = 1;
  let newShortcut = `${shortcut}_${counter}`;
  
  // Vérifier si le nouveau raccourci existe déjà
  const snippets = await getSnippets();
  while (snippets.some(s => s.shortcut === newShortcut)) {
    counter++;
    newShortcut = `${shortcut}_${counter}`;
  }
  
  return newShortcut;
}