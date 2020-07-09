const verbose = true
 
const app = new Vue({
    el: '#app',
    data: {
        pads: [],
        selected: 'home',
        mde: {},
        mdeElementName: 'mde-placeholder',
        updateRate: 10*1000, // in milliseconds
        padPrefix: 'mdp_pad_',
        listName: 'mdp_list',
        sidb: {},
        newModal: '',
        renameModal: '',
        alertText: '',
    },
    watch: {
        async selected(newVal, oldVal) {
            if (verbose) console.log(`Switching from "${oldVal}" to "${newVal}"`)

            // manually save
            if (this.pads.includes(oldVal)) {
                if (verbose) console.log(`Found "${oldVal}"`)
                await this.savePad(oldVal)
            }

            // swap the contents of the editor
            this.mde.value(await this.getPad(newVal || ''))

            // focus the text area
            this.focusAndCursorToEnd()
        },
    },
    methods: {
        async newMDE(padName) {
            const padValue = await this.getPad(padName)
            const newmde =  new EasyMDE({
                element: document.getElementById(this.mdeElementName),
                toolbar: ['heading-1', 'heading-2', 'heading-3', '|',
                    'bold', 'italic', 'strikethrough', '|',
                    'quote', 'code', '|',
                    'ordered-list', 'unordered-list', '|',
                    'link', 'image', 'table', '|',
                    'preview', 'guide'],
                placeholder: 'Write stuff!',
                lineWrapping: true,
                autofocus: true,
                renderingConfig: {
                    codeSyntaxHighlighting: true,
                },
                initialValue: padValue,
                status: ['lines', 'words'] // can be any of: autosave, lines, words, cursor
            })
            if (verbose) console.log(`Loaded pad "${padName}"`)
            return newmde
        },
        alert(text) {
            this.toggleModal('alertmodal')
            this.alertText = text
        },
        focusAndCursorToEnd() {
            if (verbose) console.log('Setting focus to text area and moving cursor to the end of the file')
            const cm = this.mde.codemirror
            cm.focus()
            cm.setCursor(cm.lineCount(), 0)
        },
        addOpenModal() { // button action
            this.toggleModal('addmodal')
            this.newModal = ''
            document.getElementById('addModalInput').focus()
        },
        renameOpenModal() { // button action
            this.toggleModal('renamemodal')
            this.newModal = ''
            document.getElementById('renameModalInput').focus()
        },
        async addPad() { // confirm button action
            const newPad = this.newModal
            if (newPad.trim() == '') {
                if (verbose) console.log(`Can't create a pad with an empty name or only spaces`)
                this.alert('You cannot create a pad with no name.')
            }
            else if (this.pads.includes(newPad)) {
                if (verbose) console.log(`Can't duplicate pad names`)
                this.alert('You cannot create a pad with the same name as an existing one.')
            }
            else {
                this.pads.push(newPad)
                await this.sidb.set(this.padPrefix+newPad, '')
                this.selected = newPad
                await this.savePadList()
                if (verbose) console.log(`Created "${newPad}"`)

                this.newModal = '' // clear text
                this.toggleModal('addmodal')
            }
        },
        async removePad() { // confirm button action
            const old = this.selected

            this.pads = this.pads.filter(el => el != old)
            await this.savePadList()
            if (verbose) console.log(`Removing "${old}"`)
            await this.sidb.delete(this.padPrefix+old)
            this.selected = 'home'

            this.toggleModal('deletemodal')
        },
        async renamePad() { // confirm button action
            const newName = this.renameModal
            if (newName.trim() == '') {
                if (verbose) console.log(`Can't rename a pad to an empty name or just spaces`)
                this.alert('You cannot rename a pad to have no name or a name of only spaces.')
            }
            else if (this.pads.includes(newName)) {
                if (verbose) console.log(`Can't duplicate pad names`)
                this.alert('You cannot rename a pad to the same name as an existing one.')
            }
            else {
                const oldName = this.selected
                const index = this.pads.indexOf(oldName)
                this.pads[index] = newName
                this.selected = newName
                if (verbose) console.log(`Renamed "${oldName}" to "${newName}"`)

                this.renameModal = ''
                this.toggleModal('renamemodal')
            }
        },
        async savePad(location) { // button action
            if (verbose) console.log(`Saving "${location}"`)
            await this.sidb.set(this.padPrefix+location, this.mde.value())
        },
        toggleModal(id) {
            const $modal = document.getElementById(id)
            $modal.classList.toggle('show-modal')
        },
        async getPad(location) {
            if (verbose) console.log(`Getting "${location}"`)
            return await this.sidb.get(this.padPrefix+location)
        },
        async downloadPad() {
            const filename = this.selected + '.md'
            const data = this.mde.value()
            const file = new Blob([data], {type: 'text/markdown'})
            const a = document.createElement('a')
            const url = URL.createObjectURL(file)
            a.href = url
            a.download = filename
            document.body.appendChild(a)
            a.click()
            setTimeout(()=>{
                document.body.removeChild(a)
                window.URL.revokeObjectURL(url)
            }, 0)
        },
        async savePadList() {
            if (verbose) console.log(`Saving list`)
            await this.sidb.set(this.listName, JSON.stringify(this.pads))
        },
        async loadPadList() {
            if (verbose) console.log(`Loading list`)
            const storedPads = await this.sidb.get(this.listName)
            if (storedPads) this.pads = JSON.parse(storedPads)
            else this.pads = ['home']
        },
        async foundLegacyStorage() {
            let oldList = localStorage.getItem('mdp-list')
            if (oldList) {
                if (verbose) console.log('Found legacy mdp settings in localStorage...')

                // turn oldList into an array
                if (verbose) console.log(`Legacy pad list: ${oldList}`)
                oldList = JSON.parse(oldList)

                // load and save in new format
                this.pads = oldList
                this.savePadList()

                // go through the array and copy all pads to new format
                for (let i = 0; i < oldList.length; i++) {
                    const padName = oldList[i]
                    const oldKey = 'smde_'+padName
                    const newKey = this.padPrefix+padName
                    const padVal = localStorage.getItem(oldKey)

                    if (verbose) console.log(`Copying "${oldKey}" (localStorage) to "${newKey}" (indexedDB)`)
                    await this.sidb.set(newKey, padVal)
                }

                // clear legacy data from localStorage
                if (verbose) console.log('Clearing localStorage')
                localStorage.clear()

                return true
            }
            return false
        },
    },
    async mounted() {
        // set up simpleIndexedDB
        this.sidb = await simpleIndexedDB()

        // set up highlight.js
        hljs.initHighlightingOnLoad()

        // set up initial mde and check for the legacy/localStorage version
        if (!await this.foundLegacyStorage()) await this.loadPadList()
        this.mde = await this.newMDE(this.selected)
        this.focusAndCursorToEnd()

        // save on unload
        window.onbeforeunload = () => {
            this.savePad(this.selected)
            this.savePadList()
        }

        // periodic save
        const periodicSave = async () => {
            setTimeout(async () => {
                if (verbose) {
                    const d = new Date()
                    console.log(`Periodic save: ${d.toLocaleString()}`)
                }
                await this.savePad(this.selected)
                periodicSave()
            }, this.updateRate)
        }
        periodicSave()
    },
})
