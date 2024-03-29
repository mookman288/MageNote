//Different implementations of IndexedDB exist depending upon the browser. Using the || operator sequentially checks via priority.
const indexedDb = (window.indexedDB || window.webkitIndexedDB || window.msIndexedDB).open("MageNote", 1);

//Similarly, different implementations of the Web Speech API, and Speech Recognition API, exist.
const sr = window.SpeechRecognition || window.webkitSpeechRecognition || window.mozSpeechRecognition || window.msSpeechRecognition;

//Some browsers do not support Speech Recognition at all.
const speechRecognition = (typeof sr !== 'undefined') ? new sr() : null;

//Set the language.
let currentLanguage = "english";

//Language support.
const language = {
	'english': {
		'lang': 'en-US',
		'translations': {
			"persistentNotice": "Your browser will prune notes if storage space is limited. Backup your notes often.",
			"backupNotice": "You haven't backed up lately. Please consider backing up soon!",
			"deleteConfirm": "Are you sure you want to delete this note?",
			"corruptNoticeP1": "Are you sure you want to delete this note?",
			"corruptCTA": "click here to initialize",
			"corruptNoticeP2": ", otherwise import your backup.",
			"indexedDbErrorNotice": "There was an error initializing the database.",
			"noteDeleteNotice": "Your note has been deleted.",
			"noteUpdateNotice": "Your notes have been updated.",
			"speechRecognitionSupportAlert": "Speech Recognition is not supported in your browser.",
			"speechRecognitionErrorAlert": "The speech recognition service did not hear you.",
			"speechRecognitionNoResultAlert": "The speech recognition service could not understand you.",
			"deleteDatabaseConfirm": "Are you sure you want to delete your database and all of the notes? This action cannot be undone."
		},
		'onLoad': {
			"backup": "Backup",
			"import": "Import",
			"importWarning": "Warning: backup your notes before continuing.",
			"search": "Search",
			"recentlyUpdatedNotes": "Recently Updated Notes",
			"createNote": "Create Note",
			"noNotes": "You do not have any notes.",
			"noteWarning": "Note taking is localized to your browser. If you clear your data for this domain, you may lose your notes. Be sure to backup often.",
			"speechRecognitionWarning": "Speech recognition through the Web Speech API requires access to the Internet to process your voice. Each browser implements this service differently.",
			"whereVoiceGoes": "Learn More About Where Your Voice Goes",
			"googlePrivacyPolicy": "Google Cloud Speech-To-Text Privacy Policy",
			"createdBy": "was created by PxO Ink LLC",
			"deleteAllNotes": "Delete All Notes",
			"permanentlyDeleteAllNotes": "Permanently Delete Database and All Notes",
			"record": "Record",
			"close": "Close",
			"note": "Note",
			"save": "Save"
		}
	}
};

//Language selector.
const selectLanguage = (languageValue) => {
	if (typeof language[languageValue] !== 'undefined') {
		currentLanguage = languageValue;

		localStorage.setItem("MageNoteLanguage", currentLanguage);

		console.log(languageValue, localStorage.getItem("MageNoteLanguage"));

		const elements = document.querySelectorAll("[data-translate-key]");

		elements.forEach((element) => {
			const translateKey = element.getAttribute('data-translate-key');
			const translation = language[currentLanguage].onLoad[translateKey];

			if (typeof translation !== 'undefined') {
				element.innerText = translation;
			}
		});
	}
}

//The currentStore is how we're describing and accessing IndexedDB store for the application.
let currentStore;

//Notes are stored as a collection/array.
let notes = [];

//Abstracting various HTML elements by their ID.
const languagePicker = document.getElementById('languagePicker');
const notice = document.getElementById('notice');
const recentNotes = document.getElementById('recentNotes');
const note = document.getElementById('note');
const backupNotes = document.getElementById('backupNotes');
const importNotes = document.getElementById('importNotes');
const importNotesFile = document.getElementById('importNotesFile');
const recording = document.getElementById('speechRecognition');

//If the user has chosen a different language.
if (localStorage.getItem("MageNoteLanguage")) {
	//Translate to that language.
	selectLanguage(localStorage.getItem("MageNoteLanguage"));

	//For each option.
	for(let i = 0; i < languagePicker.options.length; i++) {
		if (languagePicker.options[i].value === localStorage.getItem("MageNoteLanguage")) {
			languagePicker.options[i].selected = 'selected';
		}
	}
}

languagePicker.onchange = (event) => onClick(event, () => {
	console.log('test');
	selectLanguage(languagePicker.value);
});

//The StorageManager is a way to instruct IndexedDB to use persistent storage, because IDB doesn't implicitly persist.
if (navigator.storage && navigator.storage.persist) {
	//MDN suggests that certain browsers, like Firefox, need explicit permission for persistent storage.
	navigator.storage.persist().then(function(persistent) {
		//We include a general notice if persistence is not available. This often pops up in Chrome.
		if (!persistent) {
			notice.innerText = language[currentLanguage].translations.persistentNotice;
		}
	});
}

//Abstracting the onclick event to encapsulate the callback between actions that prevent usual onclick behavior.
const onClick = (event, callback) => {
	//Prevent the default behavior.
	event.preventDefault();

	callback();

	//If preventing the default behavior fails, return false.
	return false;
};

//Abstract the function that shows the note create/edit modal.
const showModal = () => {
	document.getElementById('noteModalContainer').style.display = 'initial';
};

//This function deletes the database.
const deleteDb = () => {
	indexedDB.deleteDatabase('MageNote');

	//Reload the page so that the database gets recreated automatically.
	window.location.reload();
};

//This function gets a fresh copy of the database from IndexedDB.
const getDb = () => {
	//Because of the asynchronous nature of the persistence check (above) and because I didn't do Promises correctly, we're looking out for errors.
	try {
		//Get all of the note records from the notes object store.
		currentStore.transaction("notes").objectStore("notes").getAll().onsuccess = (event) => {
			//Assign the notes.
			notes = event.target.result;

			//If there are notes.
			if (notes.length > 0) {
				//Use LocalStorage, which is less persistent because of cookie dependence, to check if the user backed up recently.
				let lastBackedUp = localStorage.getItem('MageNoteBackupDate');

				//If the user has not backed up in the past 5 days, provide a helpful reminder.
				if (!lastBackedUp || (Math.floor((new Date() - Date.parse(lastBackedUp)) / 86400000)) > 5) {
					notice.innerText = language[currentLanguage].translations.backupNotice;
				}

				//Clear the default message for the recentNotes element.
				recentNotes.innerHTML = '';

				//Sort the notes by descending before iterating and create a visible note record.
				notes.sort((a, b) => (b.date - a.date)).forEach((record) => {
					let element = document.createElement('div');
					let header = document.createElement('h2');
					let tools = document.createElement('div');
					let editButton = document.createElement('button');
					let deleteButton = document.createElement('button');
					let content = document.createElement('p');

					header.innerText = '#' + record.id + ': ' + record.date.toDateString() + ' ' + record.date.toLocaleTimeString();

					tools.classList.add('noteTools');

					editButton.setAttribute('data-id', record.id);
					editButton.classList.add('edit');
					editButton.innerText = 'Edit';

					deleteButton.setAttribute('data-id', record.id);
					deleteButton.classList.add('delete');
					deleteButton.innerText = 'Delete';

					tools.append(editButton);
					tools.append(document.createElement('hr')); //Add a horizontal rule betweeen buttons.
					tools.append(deleteButton);

					//nl2br
					content.innerHTML = record.note.replace(/([^>\r\n]?)(\r\n|\n\r|\r|\n)/g, "<br />");

					element.append(header);
					element.append(tools);
					element.append(content);

					recentNotes.append(element);
				});
			}

			let editButtons = document.getElementsByClassName('edit');
			let deleteButtons = document.getElementsByClassName('delete');

			//For all of the edit buttons, provide an interface to load the note modal for editing.
			for (let i = 0; i < editButtons.length; i++) {
				//When the edit button is clicked.
				editButtons[i].onclick = (event) => onClick(event, () => {
					//Get the id, parsed as an integer.
					const id = parseInt(event.srcElement.getAttribute('data-id'));
					let storedNote;

					try {
						//Find the correct note record, which requires some form of iteration.
						notes.forEach((record) => {
							if (record.id === id) {
								storedNote = record;

								//https://stackoverflow.com/a/2641374
								throw BreakException;
							}
						})
					} catch (e) {}

					//Set the note textarea name to the id and the value to the note text.
					note.setAttribute('name', storedNote.id);
					note.value = storedNote.note;

					showModal();
				});
			}

			//For all of the delete buttons, provide a confirmation dialog before deleting the note.
			for (let i = 0; i < editButtons.length; i++) {
				//When the delete button is clicked.
				deleteButtons[i].onclick = (event) => onClick(event, () => {
					if (confirm(language[currentLanguage].translations.deleteConfirm)) {
						//Get the id, parsed as an integer.
						const id = parseInt(event.srcElement.getAttribute('data-id'));

						//Delete the record.
						deleteRecord(id);
					}
				});
			}
		}
	} catch (error) {
		//The error that is most common on Firefox is that the IndexedDB database is created, but not the notes store.
		if (error.toString().includes('not a known object store name')) {
			//Include a notice to the user explaining what is most likely wrong.
			notice.innerHTML = language[currentLanguage].translations.corruptNoticeP1 +
				'<a id="initializeDatabase" href="#initializeDatabase">' + language[currentLanguage].translations.corruptCTA + '</a>' +
				language[currentLanguage].translations.corruptNoticeP2;

			//Provide an outlet for the user to delete their database.
			document.getElementById('initializeDatabase').onclick = (event) => onClick(event, () => {
				deleteDb();
			});
		} else {
			notice.innerText = error;
		}
	}
}

//This is fired if IndexedDB tosses an error.
indexedDb.onerror = (event) => {
	notice.innerText = language[currentLanguage].translations.indexedDbErrorNotice;
};

//Set the currentStore variable to the current database store.
indexedDb.onsuccess = (event) => {
	currentStore = event.target.result;

	//Get a fresh copy of the database.
	getDb();
};

//The onupgradeneeded is fired on any version upgrade, from nothing to 1, 1 to 2, etc., and runs all associated migrations.
indexedDb.onupgradeneeded = (event) => {
	currentStore = event.target.result;

	//Create the notes store and set the keyPath to a manually autoIncremented primary key: id.
	const objectStore = currentStore.createObjectStore("notes", {
		keyPath: 'id'
	});

	//Create the id index and set it to unique, so that the "put" method (later) updates records instead of creating them.
	objectStore.createIndex('id', 'id', {unique: true});

	//When the transaction is complete, migrate all of the existing notes (from previous versions.)
	objectStore.transaction.oncomplete = (event) => {
		const noteObjectStore = currentStore.transaction("notes", "readwrite").objectStore("notes");

		notes.forEach((record) => {
			noteObjectStore.add(record);
		});
	};
};

//https://davidwalsh.name/speech-recognition
if (speechRecognition !== null) {
	speechRecognition.interimResults = false;
	speechRecognition.maxAlternatives = 5;
}

//Abstract getting the note object store.
const getNoteObjectStore = (success) => {
	const transaction = currentStore.transaction("notes", "readwrite");

	transaction.oncomplete = (event) => {
		notice.innerText = success;
	}

	transaction.onerror = (event) => {
		notice.innerText = event.target.errorCode;
	};

	const noteObjectStore = transaction.objectStore("notes");

	return noteObjectStore;
}

//Delete the record from the notes store.
const deleteRecord = (id) => {
	const noteObjectStore = getNoteObjectStore(language[currentLanguage].translations.noteDeleteNotice);

	noteObjectStore.delete(id);

	//Refresh the database.
	getDb();
}

//This function updates the IndexedDb to whatever the current notes collection is storing.
const updateDb = () => {
	const noteObjectStore = getNoteObjectStore(language[currentLanguage].translations.noteUpdateNotice);

	notes.forEach((record) => {
		noteObjectStore.put(record);
	});

	//Refresh the database.
	getDb();
}

//This function provides a temporary link holding the entire IndexedDb database in a json file. Large databases can be slow.
const backup = () => {
	localStorage.setItem("MageNoteBackupDate", new Date());

	//https://github.com/zengm-games/zengm/compare/8735a3e8cd4973a8b0472b8fde8dca5891917bea...c101561eed6ee05fcd18ea36a6720cd841555777
	let link = document.createElement('a');
	link.href = "data:Application/octet-stream," + encodeURIComponent(JSON.stringify(notes, null, 2));
	link.download = 'MageNote-' + (new Date()).toJSON().replace(/[^a-z0-9\-]/gi, '_') + '.json';
	link.dispatchEvent(new MouseEvent("click"));

	notice.innerText = '';
};

backupNotes.onclick = (event) => onClick(event, () => {
	backupNotes.setAttribute('disabled', 'disabled');

	backup();

	backupNotes.removeAttribute('disabled');
});

importNotes.onclick = (event) => onClick(event, () => {
	document.getElementById('importNotesContainer').style.display = 'initial';
});

//This function uses the FileReader API to parse a json file and update the database.
importNotesFile.onchange = (event) => onClick(event, () => {
	const file = importNotesFile.files[0];
	const reader = new FileReader();

	//https://javascript.plainenglish.io/javascript-file-uploads-how-to-read-file-content-d5971bd8b194
	reader.onload = () => {
		try {
			const temp = JSON.parse(reader.result);

			temp.forEach((record) => {
				record.date = new Date(record.date);
			})

			notes = temp;

			updateDb();
		} catch (error) {
			notice.innerText = error;
		}
	};

	reader.readAsText(file);
});

//This function uses the non-standard "find" API for quick search.
document.getElementById('triggerSearch').onclick = (event) => onClick(event, () => {
	find(document.getElementById('search').value);
});

//This function triggers the modal to create a note, setting the values as blank.
document.getElementById('createNote').onclick = (event) => onClick(event, () => {
	note.setAttribute('name', '');
	note.value = localStorage.getItem("MageNoteActiveNote");

	showModal();
});

document.getElementById('closeNote').onclick = (event) => onClick(event, () => {
	document.getElementById('noteModalContainer').style.display = 'none';
});

//This function triggers the speech recognition API to start recording.
recording.onclick = (event) => onClick(event, () => {
	if (speechRecognition !== null) {
		speechRecognition.lang = language[currentLanguage].lang;
		speechRecognition.start();
	} else {
		alert(language[currentLanguage].translations.speechRecognitionSupportAlert);
	}
});

let noteTimeout;

//When the user types into the note field.
note.onkeydown = () => {
	clearTimeout(noteTimeout);

	noteTimeout = setTimeout(() => {
		localStorage.setItem("MageNoteActiveNote", note.value);
	}, 250);
};

//This function increments the notes collection with the new note data, overwriting previous data.
document.getElementById('saveNote').onclick = (event) => onClick(event, () => {
	let id = parseInt(note.getAttribute('name'));

	if (!id) {
		//https://stackoverflow.com/a/34087850
		id = notes.reduce((previous, current) => {
			return (previous && previous.id > current.id) ? previous : current;
		}).id + 1;
	}

	notes.push({
		'id': id,
		'date': (new Date()),
		'note': note.value
	});

	updateDb();

	localStorage.setItem("MageNoteActiveNote", '');

	document.getElementById('noteModalContainer').style.display = 'none';
});

//If speech recognition is supported.
if (speechRecognition !== null) {
	//Show a fancy pulse animation to indicate that speech recognition is listening.
	speechRecognition.onstart = (event) => {
		recording.classList.add('disabled');
		recording.classList.add('pulse');
	}

	//When speech recognition provides a result, update the note value.
	speechRecognition.onresult = (event) => {
		//Get the transcript.
		let transcript = event.results[0][0].transcript;

		//Manipulate the transcript to capitalize the first letter and end the sentence in a period.
		transcript = transcript.charAt(0).toUpperCase() + transcript.slice(1) + '.';

		//Add a new line and update the note value.
		note.value += ((note.value.length > 1) ? "\r\n\n" : '') + transcript;
	};

	//If there's an error, let the user know.
	speechRecognition.onerror = (event) => {
		//If an error is not descriptive, replace it with an explanation.
		if (event.error.includes('no-speech')) {
			alert(language[currentLanguage].translations.speechRecognitionErrorAlert);
		} else {
			alert(event.error);
		}
	};

	//If there is no result, default to the ol' alert syntax with an error.
	speechRecognition.noresult = (event) => {
		alert(language[currentLanguage].translations.speechRecognitionNoResultAlert);
	}

	//Clean up our animations.
	speechRecognition.onend = (event) => {
		recording.classList.remove('disabled');
		recording.classList.remove('pulse');
	}
}

//We gotta make sure that users go through multiple steps to delete a database.
document.getElementById('preDeleteDatabase').onclick = (event) => onClick(event, () => {
	document.getElementById('preDeleteDatabase').style.display = 'none';
	document.getElementById('deleteDatabase').style.display = 'initial';
});

//Include a confirmation dialog on the final database deletion step.
document.getElementById('deleteDatabase').onclick = (event) => onClick(event, () => {
	if (confirm(language[currentLanguage].translations.deleteDatabaseConfirm)) {
		deleteDb();
	}
});