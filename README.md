# Snippet Local

Une extension Chrome pour gérer et insérer rapidement des snippets de texte avec des fonctionnalités avancées.

## 🌟 Fonctionnalités

- ✨ Gestion de snippets avec raccourcis personnalisables
- 📂 Organisation par catégories
- 🌓 Thème clair/sombre
- 🔍 Recherche instantanée
- 🤖 Intégration IA (OpenAI, Claude, Deepseek)
- 📥 Import/Export des snippets et variables
- 🔄 Variables dynamiques et commandes

### Commandes Disponibles

- `{paste}` - Coller le contenu du presse-papiers
- `{wait:X}` - Attendre X secondes
- `{enter}` - Appuyer sur la touche Entrée
- `{date:format}` - Insérer la date (format: DD/MM/YYYY, HH:mm:ss)
- `{time}` - Insérer l'heure actuelle
- `{tab}` - Insérer une tabulation
- `{cursor}` - Positionner le curseur
- `{uppercase:texte}` - Convertir en majuscules
- `{lowercase:texte}` - Convertir en minuscules
- `{capitalize:texte}` - Mettre en majuscule la première lettre
- `{ai:prompt}` - Générer du texte avec l'IA (nécessite une clé API)

###⚡ Commandes dynamiques avancées

Snippet Local permet d’utiliser des commandes dynamiques, et même de les imbriquer pour des actions plus complexes. Lorsqu’une commande est imbriquée dans une autre, ce qui est entre crochets est exécuté en priorité.

Exemple d’imbrication :
👉 Poser une question à l'IA en indiquant le prompt dans une boîte de dialogue :

- `{ai:[prompt:prompt]}`
Dans cet exemple, l’extension affichera d’abord une boîte de dialogue pour saisir le prompt, puis enverra la requête à l’IA avec le texte saisi.

## 🚀 Installation

1. Téléchargez ou clonez ce dépôt
2. Ouvrez Chrome et accédez à `chrome://extensions/`
3. Activez le "Mode développeur"
4. Cliquez sur "Charger l'extension non empaquetée"
5. Sélectionnez le dossier de l'extension

## 💡 Utilisation

### Création d'un Snippet

1. Cliquez sur l'icône de l'extension
2. Appuyez sur "+ Nouveau Snippet"
3. Renseignez :
   - Un raccourci unique
   - Le texte du snippet (avec possibilité d'utiliser des commandes)
   - Une catégorie (optionnel)

### Variables Personnalisées

Les variables permettent de réutiliser des valeurs dans différents snippets :

1. Accédez aux paramètres
2. Section "Variables Personnalisées"
3. Ajoutez des variables avec la syntaxe : `{nomVariable}`

### Configuration IA

L'extension supporte trois fournisseurs d'IA :

- OpenAI (GPT-4)
- Anthropic (Claude)
- Deepseek AI

Pour configurer :

1. Accédez aux paramètres
2. Section "Configuration IA"
3. Sélectionnez votre fournisseur
4. Entrez votre clé API

## 🔧 Architecture

L'extension est construite avec :

- JavaScript moderne (ES6+)
- Chrome Extension Manifest V3
- APIs Chrome Storage et Scripting
- Intégration native des APIs d'IA

### Structure des Fichiers

```
├── manifest.json        # Configuration de l'extension
├── background.js       # Service worker
├── content.js         # Script d'injection et gestion des snippets
├── popup.html         # Interface principale
├── popup.js          # Logique de l'interface
├── options.html      # Page de paramètres
├── options.js       # Logique des paramètres
├── storage.js      # Gestion du stockage
├── styles.css     # Styles de l'interface
└── assets/       # Icônes et ressources
```

## 🛠️ Développement

### Prérequis

- Node.js et npm
- Navigateur Chrome récent
- Compte développeur pour les APIs d'IA (optionnel)

### Installation des Dépendances

```bash
npm install
```

### Dépendances Principales

- axios : Requêtes HTTP
- openai : SDK OpenAI
- anthropic : SDK Claude

## 📄 Licence

MIT License - Voir le fichier LICENSE pour plus de détails.

## 🤝 Contribution

Les contributions sont les bienvenues ! N'hésitez pas à :

1. Fork le projet
2. Créer une branche (`git checkout -b feature/AmazingFeature`)
3. Commit vos changements (`git commit -m 'Add some AmazingFeature'`)
4. Push sur la branche (`git push origin feature/AmazingFeature`)
5. Ouvrir une Pull Request

## 🐛 Signalement de Bugs

Si vous trouvez un bug, merci de créer une issue avec :

- Une description détaillée du problème
- Les étapes pour reproduire
- Le comportement attendu
- Des captures d'écran si possible
