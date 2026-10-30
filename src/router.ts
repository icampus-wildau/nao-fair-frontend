import { createRouter, createWebHistory } from "vue-router"
import { useConsole } from "./stores/console"

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", component: () => import("./views/DashboardView.vue") },
    { path: "/roboter", component: () => import("./views/RobotView.vue") },
    { path: "/llm", component: () => import("./views/LlmStudioView.vue") },
    { path: "/interaktionen", component: () => import("./views/InteractionsView.vue") },
    { path: "/setups", component: () => import("./views/SetupsView.vue") },
    { path: "/system", component: () => import("./views/SystemView.vue") },
    { path: "/schluessel", redirect: "/system" },
  ],
})

router.beforeEach(async (to, from) => {
  if (to.path === from.path) return true
  const store = useConsole()
  if (store.recoveryNavigation) { store.recoveryNavigation = false; return true }
  if (!store.isDirty) return true
  if (!window.confirm("Nicht übernommene Änderungen verwerfen und wechseln?")) return false
  return await store.discardChanges()
})
