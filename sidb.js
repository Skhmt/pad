/**
 * Promise-based (or async/await) simple key/value api for indexedDB
 * 
 * minify with: https://javascript-minifier.com/
 * prior art: https://github.com/jakearchibald/idb-keyval
 * 
 * @version 1.0.1
 */

 /**
  * Factory that creates a simpleIndexedDB object
  * 
  * @param {string} databaseName 
  */
function simpleIndexedDB(databaseName = 'simpleIDB') {
    let database
    const storeName = 'kvStore'

    /**
     * Creates or opens the [databaseName] database
     * 
     * @return {Promise}
     */
    function init() {
        return new Promise((resolve, reject) => {
            let request = indexedDB.open(databaseName, 1)
            
            // create the db the first time
            request.onupgradeneeded = () => {
                let transaction = request
                    .result
                    .createObjectStore(storeName)
                    .transaction

                transaction.oncomplete = () => {
                    database = request.result
                    resolve(request.result)
                }
            }
            request.onsuccess = () => {
                database = request.result
                resolve(request.result)
            }
            request.onerror = () => reject(request.error)
        })
    }

    /**
     * Helper function for all database transactions
     * Takes the pain out of using IDBObjectStore
     * 
     * @private
     * @param {string} permissions Can either be "rw" for readwrite or anything else for "readonly", prefer using "r"
     * @param {function} callback What to run on the objectStore
     * @param {boolean} multipleActions Default to false - used to determine if the transaction or the request contains the result
     * @return {Promise}
     */
    async function dbTransaction(permissions, callback, multipleActions = false) {
        // checking for the first run
        if (!database) await init()

        return new Promise(async (resolve, reject) => {
            const transaction = database.transaction([storeName], 
                permissions == 'rw' ? 'readwrite' : 'readonly')
            const objStore = transaction.objectStore(storeName)
            
            // do the callback function
            const request = await callback(objStore)

            // has to resolve on completion of the transaction if there are 
            // multiple actions per transaction
            if (multipleActions) {
                transaction.oncomplete = () => resolve(transaction.result)
                transaction.onerror = () => reject(transaction.error)
            }
            else {
                transaction.oncomplete = () => resolve(request.result)
                request.onerror = () => reject(request.error)
            }
        })
    }

    /**
     * Shorthand for cursor iteration
     * Ordered "value, key" because that's how Array.forEach() does it
     * 
     * @param {function} callback Has the interface: value, key, update(newValue), delete()
     * @param {boolean} reverse Allows backwards iteration over the dataset - defaults to "false"
     * @return {Promise} 
     */
    function forEach(callback, reverse = false) {
        return dbTransaction('rw', os => {
            const request = os.openCursor(null, reverse ? 'prev' : 'next')

            request.onsuccess = async event => {
                const cursor = event.target.result
                if (cursor) {
                    await callback(
                        cursor.value,
                        cursor.key,
                        async newVal => await cursor.update(newVal),
                        async () => await cursor.delete(),
                    )
                    cursor.continue()
                }
            }

            return request
        })
    }

    return {
        set(key, value) {
            return dbTransaction('rw', os => os.put(value, key))
        },
        get(key) {
            return dbTransaction('r', os => os.get(key))
        },
        delete(key) {
            return dbTransaction('rw', os => os.delete(key))
        },
        clear() {
            return dbTransaction('rw', os => os.clear())
        },
        keys() {
            return dbTransaction('r', os => os.getAllKeys())
        },
        size() {
            return dbTransaction('r', os => os.count())
        },
        async tx(callback) {
            return dbTransaction('rw', async os => await callback(os), true)
        },
        forEach,
        rofEach(fn) { // Reverse Order For Each
            return forEach(fn, true)
        }, 
    }
}