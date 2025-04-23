import { elements } from './dom-elements.js';
import { state, getNotesForUrl, saveNote, updateNote, deleteNote } from './state.js';
import { escapeHtml } from './ui-handler.js';

// notes panel management
export function openNotesPanel() {
  elements.welcomeScreen.style.display = 'none';
  elements.chatScreen.style.display = 'none';
  
  elements.notesScreen.style.display = 'flex';
  
  if (state.pageContent && state.pageContent.url) {
    state.currentPageUrl = state.pageContent.url;
    
    getNotesForUrl(state.currentPageUrl)
      .then(notes => renderNotes(notes))
      .catch(error => {
        console.error('CocBot: Error fetching notes', error);
        elements.notesList.innerHTML = '<div class="notes-error">Error loading notes</div>';
      });
  } else {
    console.log('CocBot: No page content available for notes');
    elements.notesList.innerHTML = '<div class="notes-error">Unable to get current page URL</div>';
    elements.notesEmptyState.style.display = 'none';
  }
}

function renderNotes(notes) {
  if (!notes || notes.length === 0) {
    elements.notesEmptyState.style.display = 'flex';
    elements.notesList.innerHTML = '';
    return;
  }
  
  elements.notesEmptyState.style.display = 'none';
  elements.notesList.innerHTML = '';
  
  notes.sort((a, b) => b.timestamp - a.timestamp);
  
  notes.forEach(note => {
    const noteItem = document.createElement('div');
    noteItem.className = 'note-item';
    noteItem.dataset.timestamp = note.timestamp;
    
    const noteDate = new Date(note.timestamp);
    const formattedDate = noteDate.toLocaleDateString() + ' ' + noteDate.toLocaleTimeString();
    
    noteItem.innerHTML = `
      <div class="note-content">${escapeHtml(note.content)}</div>
      <div class="note-meta">
        <span>${formattedDate}</span>
      </div>
      <div class="note-actions">
        <button class="note-action-button edit-note" title="Edit Note">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
        </button>
        <button class="note-action-button delete-note" title="Delete Note">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
    `;
    
    const editButton = noteItem.querySelector('.edit-note');
    editButton.addEventListener('click', (e) => {
      e.stopPropagation();
      editNote(note);
    });
    
    const deleteButton = noteItem.querySelector('.delete-note');
    deleteButton.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteNoteItem(note.timestamp);
    });
    
    noteItem.addEventListener('click', () => {
      editNote(note);
    });
    
    elements.notesList.appendChild(noteItem);
  });
}

export function openNoteEditor(existingContent = '') {
  elements.noteContent.value = existingContent;
  elements.noteEditor.style.display = 'flex';
  elements.noteContent.focus();
}

export function closeNoteEditor() {
  elements.noteEditor.style.display = 'none';
  elements.noteContent.value = '';
  state.currentEditingNoteTimestamp = null;
  state.isEditingNote = false;
}

export function editNote(note) {
  state.isEditingNote = true;
  state.currentEditingNoteTimestamp = note.timestamp;
  openNoteEditor(note.content);
}

export async function handleSaveNote() {
  const content = elements.noteContent.value.trim();
  
  if (!content) {
    alert('Please enter some content for your note');
    return;
  }
  
  try {
    if (state.isEditingNote && state.currentEditingNoteTimestamp) {
      await updateNote(state.currentEditingNoteTimestamp, content);
    } else {
      await saveNote({
        content: content,
        url: state.currentPageUrl,
        timestamp: Date.now()
      });
    }
    
    closeNoteEditor();
    
    const notes = await getNotesForUrl(state.currentPageUrl);
    renderNotes(notes);
  } catch (error) {
    console.error('CocBot: Error saving note', error);
    alert('Error saving note: ' + error.message);
  }
}

export async function deleteNoteItem(timestamp) {
  if (confirm('Are you sure you want to delete this note?')) {
    try {
      await deleteNote(timestamp);
      
      const notes = await getNotesForUrl(state.currentPageUrl);
      renderNotes(notes);
    } catch (error) {
      console.error('CocBot: Error deleting note', error);
      alert('Error deleting note: ' + error.message);
    }
  }
} 