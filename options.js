import { 
  getCustomVariables,
  saveCustomVariable,
  deleteCustomVariable,
  handleImportVariables
} from './storage.js';

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

document.addEventListener('DOMContentLoaded', () => {
  initializeTheme();
  loadSettings();
  setupAIConfig();
  setupExportImport();
});

function initializeTheme() {
  const savedTheme = localStorage.getItem('theme') || 'light';
  setTheme(savedTheme);
}

function setTheme(theme) {
  document.body.setAttribute('data-theme', theme);
  document.getElementById('toggleTheme').textContent = theme === 'light' ? '🌙' : '☀️';
  localStorage.setItem('theme', theme);
}

async function loadSettings() {
  await loadCustomVariables();
}

async function loadCustomVariables() {
  const variables = await getCustomVariables();
  const container = document.getElementById('customVariablesList');
  container.innerHTML = '';

  Object.entries(variables).forEach(([name, value]) => {
    const item = document.createElement('div');
    item.className = 'settings-item';
    item.innerHTML = `
      <div class="settings-content">
        <strong>{${name}}</strong>
        <span>${value}</span>
      </div>
      <div class="settings-actions">
        <button class="btn icon-btn edit-btn" title="Modifier">✏️</button>
        <button class="btn icon-btn delete-btn" title="Supprimer">🗑️</button>
      </div>
    `;

    item.querySelector('.edit-btn').addEventListener('click', () => editVariable(name, value));
    item.querySelector('.delete-btn').addEventListener('click', () => deleteVariableHandler(name));
    container.appendChild(item);
  });
}

function showVariableDialog(name = '', value = '') {
  const dialog = document.createElement('div');
  dialog.className = 'dialog-overlay';
  dialog.innerHTML = `
    <div class="dialog">
      <h2>${name ? 'Modifier la Variable' : 'Nouvelle Variable'}</h2>
      <form id="variableForm">
        <div class="form-group">
          <label for="name">Nom de la variable:</label>
          <input type="text" id="name" required value="${name}" placeholder="Ex: email" />
        </div>
        <div class="form-group">
          <label for="value">Valeur:</label>
          <input type="text" id="value" required value="${value}" placeholder="Ex: contact@example.com" />
        </div>
        <div class="dialog-buttons">
          <button type="button" class="btn secondary" id="cancelBtn">Annuler</button>
          <button type="submit" class="btn primary">Enregistrer</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(dialog);

  const form = dialog.querySelector('#variableForm');
  const cancelBtn = dialog.querySelector('#cancelBtn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const variableName = form.name.value.trim();
      const variableValue = form.value.value.trim();
      
      await saveCustomVariable(variableName, variableValue, name); // Passer l'ancien nom
      await loadCustomVariables();
      dialog.remove();
      showSuccess('Variable enregistrée avec succès');
    } catch (error) {
      console.error('Error saving variable:', error);
      showError('Erreur lors de l\'enregistrement de la variable');
    }
  });

  cancelBtn.addEventListener('click', () => dialog.remove());
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.remove();
  });
}


async function deleteVariableHandler(name) {
  if (confirm('Êtes-vous sûr de vouloir supprimer cette variable ?')) {
    try {
      await deleteCustomVariable(name);
      await loadCustomVariables();
      showSuccess('Variable supprimée avec succès');
    } catch (error) {
      console.error('Error deleting variable:', error);
      showError('Erreur lors de la suppression de la variable');
    }
  }
}

function editVariable(name, value) {
  showVariableDialog(name, value);
}

document.getElementById('toggleTheme').addEventListener('click', () => {
  const currentTheme = localStorage.getItem('theme') || 'light';
  setTheme(currentTheme === 'light' ? 'dark' : 'light');
});

document.getElementById('addVariable').addEventListener('click', () => {
  showVariableDialog();
});

function showSuccess(message) {
  const toast = createToast(message, 'success');
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function showError(message) {
  const toast = createToast(message, 'error');
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function createToast(message, type) {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  return toast;
}

async function setupAIConfig() {
  const providerSelect = document.getElementById('aiProvider');
  const saveButton = document.getElementById('saveAiConfig');
  const configs = document.querySelectorAll('.provider-config');
  const showButtons = document.querySelectorAll('.show-key');

  // Load existing configuration
  const config = await chrome.storage.local.get([
    'selectedProvider',
    'openaiApiKey',
    'claudeApiKey',
    'deepseekApiKey'
  ]);

  if (config.selectedProvider) {
    providerSelect.value = config.selectedProvider;
    showSelectedProviderConfig(config.selectedProvider);
  }

  // Set existing API keys
  document.getElementById('openaiApiKey').value = config.openaiApiKey || '';
  document.getElementById('claudeApiKey').value = config.claudeApiKey || '';
  document.getElementById('deepseekApiKey').value = config.deepseekApiKey || '';

  // Show/hide provider configurations
  providerSelect.addEventListener('change', () => {
    showSelectedProviderConfig(providerSelect.value);
  });

  // Show/hide API keys
  showButtons.forEach(button => {
    const input = button.previousElementSibling;
    
    button.addEventListener('mousedown', () => {
      input.type = 'text';
    });

    button.addEventListener('mouseup', () => {
      input.type = 'password';
    });

    button.addEventListener('mouseleave', () => {
      input.type = 'password';
    });
  });

  // Save configuration
  saveButton.addEventListener('click', async () => {
    const selectedProvider = providerSelect.value;
    const openaiApiKey = document.getElementById('openaiApiKey').value.trim();
    const claudeApiKey = document.getElementById('claudeApiKey').value.trim();
    const deepseekApiKey = document.getElementById('deepseekApiKey').value.trim();

    const currentKey = document.querySelector(`#${selectedProvider}ApiKey`).value.trim();
    if (!currentKey) {
      showError('Veuillez entrer une clé API pour le fournisseur sélectionné');
      return;
    }

    try {
      await chrome.storage.local.set({
        selectedProvider,
        openaiApiKey,
        claudeApiKey,
        deepseekApiKey
      });
      showSuccess('Configuration IA enregistrée avec succès');
    } catch (error) {
      showError('Erreur lors de l\'enregistrement de la configuration');
    }
  });
}

function showSelectedProviderConfig(provider) {
  const configs = document.querySelectorAll('.provider-config');
  configs.forEach(config => {
    config.style.display = config.id === `${provider}Config` ? 'block' : 'none';
  });
}

function setupExportImport() {
  // Variables export/import
  document.getElementById('exportVariablesLocalBtn').addEventListener('click', exportVariablesToFile);
  document.getElementById('importVariablesLocalBtn').addEventListener('click', () => {
    document.getElementById('importVariablesFile').click();
  });
  document.getElementById('importVariablesFile').addEventListener('change', importVariablesFromFile);
}

async function exportVariablesToFile() {
  try {
    const variables = await getCustomVariables();
    const blob = new Blob([JSON.stringify(variables, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'snippet-local-variables.json';
    a.click();
    
    URL.revokeObjectURL(url);
    showSuccess('Export des variables réussi');
  } catch (error) {
    showError('Erreur lors de l\'export des variables');
  }
}

async function importVariablesFromFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const result = await handleImportVariables(event);
    if (result.success) {
      await loadCustomVariables();
      showSuccess(`Import réussi : ${result.imported} variables importées, ${result.conflicts} conflits résolus`);
    }
  } catch (error) {
    console.error('Error importing variables:', error);
    showError('Erreur lors de l\'import des variables');
  }
  event.target.value = '';
}