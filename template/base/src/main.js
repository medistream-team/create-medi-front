import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import store from "./store";
import VueLazyload from "vue-lazyload";

import "./styles/main.scss";
import "inticons/fonts/inticons.bundle.min.css";

const app = createApp(App);

app.use(router);
app.use(store);
app.use(VueLazyload, {
  preLoad: 1.3,
});

app.mount("#app");
