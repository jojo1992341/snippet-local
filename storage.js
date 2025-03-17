const SNIPPETS_KEY = 'snippets';
const CATEGORIES_KEY = 'categories';
const CUSTOM_VARIABLES_KEY = 'customVariables';

export async function getSnippets() {
  try {
    const result = await chrome.storage.local.get(SNIPPETS_KEY);
    return result[SNIPPETS_KEY] || [];
  } catch (error) {
    console.error('Error getting snippets:', error);
    return [];
  }
}

export async function saveSnippet(snippet) {
  try {
    const snippets = await getSnippets();
    const index = snippets.findIndex(s => s.id === snippet.id);
    
    if (index >= 0) {
      snippets[index] = snippet;
    } else {
      snippet.id = crypto.randomUUID();
      snippets.push(snippet);
    }

    await chrome.storage.local.set({ [SNIPPETS_KEY]: snippets });
  } catch (error) {
    console.error('Error saving snippet:', error);
    throw error;
  }
}

export async function deleteSnippet(id) {
  try {
    const snippets = await getSnippets();
    const filtered = snippets.filter(s => s.id !== id);
    await chrome.storage.local.set({ [SNIPPETS_KEY]: filtered });
  } catch (error) {
    console.error('Error deleting snippet:', error);
    throw error;
  }
}

export async function getCategories() {
  try {
    const result = await chrome.storage.local.get(CATEGORIES_KEY);
    return result[CATEGORIES_KEY] || [];
  } catch (error) {
    console.error('Error getting categories:', error);
    return [];
  }
}

export async function saveCategory(category) {
  try {
    const categories = await getCategories();
    if (!categories.includes(category)) {
      categories.push(category);
      await chrome.storage.local.set({ [CATEGORIES_KEY]: categories });
    }
  } catch (error) {
    console.error('Error saving category:', error);
    throw error;
  }
}

export async function getCustomVariables() {
  try {
    const result = await chrome.storage.local.get(CUSTOM_VARIABLES_KEY);
    return result[CUSTOM_VARIABLES_KEY] || {};
  } catch (error) {
    console.error('Error getting custom variables:', error);
    return {};
  }
}

export async function saveCustomVariable(name, value, oldName = null) {
  try {
    const variables = await getCustomVariables();
    
    // Supprimer les accolades du nom si elles sont présentes
    const cleanName = name.replace(/[{}]/g, '');
    
    // Si on a un ancien nom et qu'il est différent du nouveau nom, supprimer l'ancienne variable
    if (oldName) {
      const cleanOldName = oldName.replace(/[{}]/g, '');
      if (cleanOldName !== cleanName) {
        delete variables[cleanOldName];
      }
    }
    
    // Mettre à jour ou ajouter la nouvelle variable
    variables[cleanName] = value;
    
    await chrome.storage.local.set({ [CUSTOM_VARIABLES_KEY]: variables });
  } catch (error) {
    console.error('Error saving custom variable:', error);
    throw error;
  }
}

export async function deleteCustomVariable(name) {
  try {
    const variables = await getCustomVariables();
    const cleanName = name.replace(/[{}]/g, '');
    delete variables[cleanName];
    await chrome.storage.local.set({ [CUSTOM_VARIABLES_KEY]: variables });
  } catch (error) {
    console.error('Error deleting custom variable:', error);
    throw error;
  }
}

export async function handleImportVariables(event) {
  try {
    let importedVariables;
    
    if (event.target instanceof HTMLInputElement && event.target.files) {
      // Import from file
      const file = event.target.files[0];
      const text = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.readAsText(file);
      });
      importedVariables = JSON.parse(text);
    } else if (event.target?.result) {
      // Import from string
      importedVariables = JSON.parse(event.target.result);
    } else {
      throw new Error('Invalid import source');
    }

    if (typeof importedVariables !== 'object' || importedVariables === null) {
      throw new Error('Format de fichier invalide');
    }

    // Récupérer les variables existantes
    const existingVariables = await getCustomVariables();
    
    // Vérifier les conflits
    const conflicts = [];
    const nonConflicting = {};
    
    for (const [name, value] of Object.entries(importedVariables)) {
      if (existingVariables.hasOwnProperty(name)) {
        conflicts.push({
          name,
          existing: existingVariables[name],
          new: value
        });
      } else {
        nonConflicting[name] = value;
      }
    }
    
    // S'il n'y a pas de conflits, importer directement
    if (conflicts.length === 0) {
      await chrome.storage.local.set({ 
        [CUSTOM_VARIABLES_KEY]: { ...existingVariables, ...nonConflicting }
      });
      return { success: true, imported: Object.keys(importedVariables).length, conflicts: 0 };
    }
    
    // Traiter les conflits un par un
    const resolvedVariables = { ...nonConflicting };
    
    for (const conflict of conflicts) {
      const response = await handleVariableConflictDialog(conflict);
      
      if (response === 'keep-existing') {
        // Garder l'existant
        resolvedVariables[conflict.name] = conflict.existing;
      } else if (response === 'keep-new') {
        // Remplacer par le nouveau
        resolvedVariables[conflict.name] = conflict.new;
      }
    }
    
    // Mettre à jour le stockage avec les résultats
    const updatedVariables = {
      ...existingVariables,
      ...resolvedVariables
    };
    
    await chrome.storage.local.set({ [CUSTOM_VARIABLES_KEY]: updatedVariables });
    
    return { 
      success: true, 
      imported: Object.keys(resolvedVariables).length, 
      conflicts: conflicts.length 
    };
  } catch (error) {
    console.error('Error in handleImportVariables:', error);
    throw error;
  }
}

async function handleVariableConflictDialog(conflict) {
  return new Promise((resolve) => {
    const dialog = document.createElement('div');
    dialog.className = 'dialog-overlay';
    dialog.innerHTML = `
      <div class="dialog">
        <h2>Conflit de variable</h2>
        <p>La variable <strong>{${conflict.name}}</strong> existe déjà.</p>
        
        <div class="snippet-preview">
          <h3>Variable existante</h3>
          <div class="snippet-details">
            <p><strong>Nom:</strong> ${conflict.name}</p>
            <p><strong>Valeur:</strong></p>
            <pre>${conflict.existing}</pre>
          </div>
        </div>
        
        <div class="snippet-preview">
          <h3>Nouvelle variable</h3>
          <div class="snippet-details">
            <p><strong>Nom:</strong> ${conflict.name}</p>
            <p><strong>Valeur:</strong></p>
            <pre>${conflict.new}</pre>
          </div>
        </div>
        
        <div class="dialog-buttons">
          <button class="btn secondary" id="keepExisting">Garder l'existante</button>
          <button class="btn primary" id="keepNew">Utiliser la nouvelle</button>
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

    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) {
        dialog.remove();
        resolve('keep-existing');
      }
    });
  });
}

export async function handleImportSnippets(event) {
  try {
    let importedSnippets;
    
    if (event.target instanceof HTMLInputElement && event.target.files) {
      // Import from file
      const file = event.target.files[0];
      const text = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.readAsText(file);
      });
      importedSnippets = JSON.parse(text);
    } else if (event.target?.result) {
      // Import from string
      importedSnippets = JSON.parse(event.target.result);
    } else {
      throw new Error('Invalid import source');
    }

    if (!Array.isArray(importedSnippets)) {
      throw new Error('Format de fichier invalide');
    }

    // Récupérer les snippets existants
    const { snippets: existingSnippets = [] } = await chrome.storage.local.get(['snippets']);
    
    // Vérifier les conflits
    const conflicts = [];
    const nonConflicting = [];
    
    for (const newSnippet of importedSnippets) {
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
      return { success: true, imported: importedSnippets.length, conflicts: 0 };
    }
    
    // Traiter les conflits un par un
    const resolvedSnippets = [...nonConflicting];
    
    for (const conflict of conflicts) {
      const response = await handleConflictDialog(conflict.existing, conflict.new);
      
      if (response === 'keep-existing') {
        // Garder l'existant (ne rien faire)
      } else if (response === 'keep-new') {
        // Remplacer par le nouveau
        const index = existingSnippets.findIndex(s => s.shortcut === conflict.existing.shortcut);
        if (index !== -1) {
          existingSnippets[index] = conflict.new;
        }
        resolvedSnippets.push(conflict.new);
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
  } catch (error) {
    console.error('Error in handleImportSnippets:', error);
    throw error;
  }
}

async function handleConflictDialog(existingSnippet, newSnippet) {
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
          <button class="btn primary" id="keepNew">Utiliser le nouveau</button>
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

    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) {
        dialog.remove();
        resolve('keep-existing');
      }
    });
  });
}