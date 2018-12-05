function errorHandler(error) {
  return new Error(error);
}

const storeEventHandler = request =>
  new Promise((resolve, reject) => {
    request.onsuccess = event => resolve(event.target.result);
    request.onerror = event => reject(errorHandler(event.target.error));
    request.onabort = event => reject(errorHandler(event.target.error));
    request.oncomplete = event => resolve(event.target.result);
    request.onclose = event => reject(errorHandler(event.target.error));
  });
const transaction = (table, permission) => db => {
  let request = db.transaction([table], permission ? permission : "readonly");
  return {
    request,
    store: request.objectStore(table)
  };
};

const _readAll = ({ request, store }) => {
  if (typeof store.getAll === "function") {
    return store.getAll();
  } else {
    return store.openCursor();
  }
};

const insertToStore = docs => {
  return function({ store, request }) {
    for (let doc of docs) {
      store.add(doc);
    }
    return request;
  };
};

const insertToStoreErrorHandler = error => {
  if (error.message === "QuotaExceededError") {
    return Promise.reject("Reach maximum quota");
  }
  return error;
};

export const open = ({ name, version, table, keyPath, indexes }) =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(name, version);

    request.onsuccess = event => {
      console.log("Database open successfully");
      const db = event.target.result;
      storeEventHandler(event);
      // console.log(event.target);
      resolve(db);
    };
    request.onerror = event => reject(event.target.error);
    request.onupgradeneeded = event =>
      create({
        db: event.target.result,
        table,
        keyPath,
        indexes
      });
  });

export const create = ({ db, table, keyPath, indexes }) => {
  if (!db.objectStoreNames.contains(table)) {
    const store = db.createObjectStore(table, { keyPath });
    for (let index of indexes) {
      store.createIndex(index[0], index[1], { unique: index[2] });
    }
  }
  db.transaction.oncomplete = event => {
    console.log("db created");
  };
};

export const insert = (db, table) => docs =>
  db
    .then(transaction(table, "readwrite"))
    .then(insertToStore(docs))
    .then(storeEventHandler)
    .catch(insertToStoreErrorHandler);

export const read = (db, table) => key =>
  db
    .then(transaction(table, "readonly"))
    .then(({ store }) => store.get(key))
    .then(storeEventHandler);

export const readAll = (db, table) =>
  db
    .then(transaction(table))
    .then(_readAll)
    .then(storeEventHandler);

export const update = (db, table) => data =>
  db
    .then(transaction(table, "readwrite"))
    .then(({ store }) => store.put(data))
    .then(storeEventHandler);
export const remove = (db, table) => key =>
  db
    .then(transaction(table, "readwrite"))
    .then(({ store }) => store.delete(key))
    .then(storeEventHandler);

export const findByIndex = (db, table) => (keyIndex, keyValue) =>
  db
    .then(transaction(table, "readonly"))
    .then(({ store }) => store.index(keyIndex).get(keyValue))
    .then(storeEventHandler);
