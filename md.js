const verbose = true

const app = new Vue({
    el: '#app',
    data: {
        pads: [],
        selected: 'home',
        mde: {},
        smdeElementName: 'smde-placeholder',
        updateRate: 10*1000, // in milliseconds
        padPrefix: 'mdp_pad_', // mdp_pad_
        listName: 'mdp_list',
        sidb: {},
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
            this.mde.value(await this.getPad(newVal))
        },
    },
    methods: {
        async newMDE(padName) {
            const padValue = await this.getPad(padName)
            const smde =  new SimpleMDE({
                element: document.getElementById(this.smdeElementName),
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
                status: ['lines', 'words'] // autosave, lines, words, cursor
            })
            if (verbose) console.log(`Loaded pad "${padName}"`)
            return smde
        },
        async addPad() { // button action
            const newPad = prompt('Enter the name of a new pad')
            if (newPad) {
                this.pads.push(newPad)
                this.selected = newPad
                await this.savePadList()
                if (verbose) console.log(`Created ${newPad}`)
            }
        },
        async removePad() { // button action
            const old = this.selected
            if (confirm(`Are you sure you want to PERMANENTLY remove "${old}"?`)) {
                this.pads = this.pads.filter(el => el != old)
                await this.savePadList()
                if (verbose) console.log(`Removing "${old}"`)
                await this.sidb.delete(this.padPrefix+old)
                this.selected = 'home'
            }
        },
        async savePad(location) {
            if (verbose) console.log(`Saving "${location}"`)
            await this.sidb.set(this.padPrefix+location, this.mde.value())
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
        }
    },
    async mounted() {
        // set up simpleIndexedDB
        this.sidb = await simpleIndexedDB()

        // set up highlight.js
        hljs.initHighlightingOnLoad()

        // set up initial mde and check for the legacy/localStorage version
        if (!await this.foundLegacyStorage()) await this.loadPadList()
        this.mde = await this.newMDE(this.selected)

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

        // adapter to save new things
    },
})