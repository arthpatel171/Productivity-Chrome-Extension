const STORAGE_KEY = 'todoBlocks';
let activeEditor = null;

function createBlock(block = {}) {
  const article = document.createElement('article');
  article.className = 'todo-extension-block';

  const toolbar = document.createElement('div');
  toolbar.className = 'todo-extension-toolbar';

  const title = document.createElement('span');
  title.className = 'todo-extension-block-label';
  title.textContent = 'Note';
  toolbar.appendChild(title);

  addFormatButton(toolbar, 'B', 'Bold', 'bold');
  addFormatButton(toolbar, 'H', 'Highlight', 'hiliteColor', '#fff176');
  addFormatButton(toolbar, 'A+', 'Large text', 'formatBlock', 'h2');

  const deleteButton = document.createElement('button');
  deleteButton.type = 'button';
  deleteButton.className = 'todo-extension-delete';
  deleteButton.textContent = 'Delete';
  deleteButton.title = 'Delete this text box';
  toolbar.appendChild(deleteButton);

  const editor = document.createElement('div');
  editor.className = 'todo-extension-editor';
  editor.contentEditable = 'true';
  editor.dataset.placeholder = 'Start typing...';
  editor.innerHTML = block.html || '';

  article.append(toolbar, editor);

  editor.addEventListener('input', () => {
    applyTypingShortcut(editor);
    saveBlocks();
  });
  editor.addEventListener('focus', () => {
    activeEditor = editor;
  });

  editor.addEventListener('keydown', (event) => {
    if (event.key === 'Tab') {
      event.preventDefault();
      document.execCommand('insertText', false, '    ');
    }
  });

  deleteButton.addEventListener('click', () => {
    const blocks = document.querySelectorAll('.todo-extension-block');
    if (blocks.length === 1) {
      editor.innerHTML = '';
      editor.focus();
    } else {
      article.remove();
    }
    saveBlocks();
  });

  return article;
}

function addFormatButton(toolbar, label, title, command, value = null) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'todo-extension-format';
  button.textContent = label;
  button.title = title;
  button.addEventListener('mousedown', (event) => event.preventDefault());
  button.addEventListener('click', () => {
    if (!activeEditor) {
      return;
    }
    activeEditor.focus();
    document.execCommand(command, false, value);
    saveBlocks();
  });
  toolbar.appendChild(button);
}

function applyTypingShortcut(editor) {
  const selection = window.getSelection();
  if (!selection.rangeCount || !editor.contains(selection.anchorNode)) {
    return;
  }

  const line = selection.anchorNode.textContent.slice(0, selection.anchorOffset);
  const shortcut = line.match(/(?:^|\n)(1\)|\*|#) $/);
  if (!shortcut) {
    return;
  }

  const marker = shortcut[1];
  const range = selection.getRangeAt(0);
  range.setStart(selection.anchorNode, selection.anchorOffset - marker.length - 1);
  range.deleteContents();
  selection.removeAllRanges();
  selection.addRange(range);

  if (marker === '1)') {
    document.execCommand('insertOrderedList');
  } else if (marker === '*') {
    document.execCommand('insertUnorderedList');
  } else {
    document.execCommand('formatBlock', false, 'h2');
  }
}

function saveBlocks() {
  const blocks = [...document.querySelectorAll('.todo-extension-editor')]
    .map((editor) => ({ html: editor.innerHTML }));
  chrome.storage.local.set({ [STORAGE_KEY]: blocks });
}

function loadBlocks() {
  chrome.storage.local.get([STORAGE_KEY, 'todoData'], (result) => {
    let blocks = result[STORAGE_KEY];
    if (!Array.isArray(blocks) || blocks.length === 0) {
      blocks = result.todoData ? [{ html: escapeStoredText(result.todoData) }] : [{}];
    }

    const workspace = document.getElementById('todo-extension-workspace');
    blocks.forEach((block) => workspace.appendChild(createBlock(block)));
    updateStatus('Ready');
  });
}

function escapeStoredText(text) {
  const element = document.createElement('div');
  element.textContent = text;
  return element.innerHTML.replace(/\n/g, '<br>');
}

function updateStatus(message) {
  const status = document.getElementById('todo-extension-status');
  if (status) {
    status.textContent = message;
  }
}

function initializeTodoList() {
  if (document.getElementById('todo-extension-app')) {
    return;
  }

  document.documentElement.className = 'todo-extension-page';
  document.body.replaceChildren();

  const app = document.createElement('main');
  app.id = 'todo-extension-app';

  const header = document.createElement('header');
  header.className = 'todo-extension-header';
  header.innerHTML = '<h1>Notes</h1><p id="todo-extension-status">Loading...</p>';

  const workspace = document.createElement('section');
  workspace.id = 'todo-extension-workspace';

  const addButton = document.createElement('button');
  addButton.type = 'button';
  addButton.id = 'todo-extension-add';
  addButton.textContent = '+ Add text box';
  addButton.addEventListener('click', () => {
    const block = createBlock();
    workspace.appendChild(block);
    block.querySelector('.todo-extension-editor').focus();
    saveBlocks();
  });

  app.append(header, workspace, addButton);
  document.body.appendChild(app);
  loadBlocks();

  window.addEventListener('beforeunload', saveBlocks);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      saveBlocks();
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeTodoList);
} else {
  initializeTodoList();
}
