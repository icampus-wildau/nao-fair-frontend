import { createApp } from "vue"
import { createPinia } from "pinia"
import { Icon } from "@iconify/vue"
import ui from "@nuxt/ui/vue-plugin"
import App from "./App.vue"
import { registerIcons } from "./icons"
import { router } from "./router"
import "./assets/main.css"
import "@fontsource/ibm-plex-sans/400.css"
import "@fontsource/ibm-plex-sans/500.css"
import "@fontsource/ibm-plex-sans/600.css"
import "@fontsource/ibm-plex-mono/400.css"

registerIcons()
const app = createApp(App)
app.component("Icon", Icon)
app.use(createPinia())
app.use(router)
app.use(ui)
app.mount("#app")
