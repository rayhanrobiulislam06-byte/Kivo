(function () {
    "use strict";

    const API_BASE = "http://127.0.0.1:3001";

    const aiStatus = document.getElementById("aiStatus");
    const aiStatusText = document.getElementById("aiStatusText");

    async function checkAIStatus() {
        if (!aiStatus || !aiStatusText) return;

        try {
            const response = await fetch(API_BASE + "/health", {
                method: "GET",
                cache: "no-store"
            });

            if (!response.ok) {
                throw new Error("Health check failed");
            }

            const data = await response.json();

            aiStatus.classList.add("connected");
            aiStatus.classList.remove("offline");

            aiStatusText.textContent =
                data.aiConfigured === false
                    ? "Gemma 4 E2B • On-device"
                    : "On-device AI";
        } catch (error) {
            aiStatus.classList.add("offline");
            aiStatus.classList.remove("connected");
            aiStatusText.textContent = "AI offline • Start Kivo";
        }
    }

    const PLACEHOLDER_ADDRESS = "YOUR_TRC20_ADDRESS";

    function byId(id) {
        return document.getElementById(id);
    }

    function showFatal(message) {
        console.error(message);
        const banner = document.createElement("div");
        banner.setAttribute("role", "alert");
        banner.style.cssText =
            "position:fixed;top:0;left:0;right:0;z-index:100;" +
            "padding:12px 16px;background:#b00020;color:#fff;" +
            "font:14px/1.4 system-ui,sans-serif;";
        banner.textContent = message;
        document.body.appendChild(banner);
    }

    /* ---------- Core elements: missing => clear error ---------- */
    const CORE_IDS = ["main", "chat", "form", "message", "send"];
    const missingCore = CORE_IDS.filter(id => !byId(id));

    if (missingCore.length) {
        showFatal(
            "Kivo UI error: missing required element(s): " +
            missingCore.join(", ")
        );
        return;
    }

    const body = document.body;
    const main = byId("main");
    const chat = byId("chat");
    const form = byId("form");
    const input = byId("message");
    const send = byId("send");

    /* ---------- Optional elements ---------- */
    const toast = byId("toast");
    const sidebarOverlay = byId("sidebarOverlay");
    const closeSidebar = byId("closeSidebar");
    const sidebarNewChat = byId("sidebarNewChat");
    const historyItem = byId("historyItem");
    const settingsItem = byId("settingsItem");
    const featuresItem = byId("featuresItem");
    const donationItem = byId("donationItem");
    const conversationsPanel = byId("conversationsPanel");
    const closeConversations = byId("closeConversations");
    const aboutPanel = byId("settingsPanel");
    const featuresPanel = byId("featuresPanel");
    const closeFeatures = byId("closeFeatures");
    const closeAbout = byId("closeSettings");
    const donationPanel = byId("donationPanel");
    const closeDonation = byId("closeDonation");
    const menuButton = byId("menu");
    const newChatButton = byId("newChat");
    const copyButton = byId("copyDonationAddress");
    const donationAddress = byId("donationAddress");
    const conversationList = byId("conversationList");
    const aboutApiBase = byId("aboutApiBase");

    if (aboutApiBase) aboutApiBase.textContent = API_BASE;

    /* ---------- State ---------- */
    let currentConversationId = null;
    let conversations = [];
    let sending = false;
    let toastTimer = null;

    /* ---------- API layer: keeps real backend errors ---------- */
    class ApiError extends Error {
        constructor(kind, message, status) {
            super(message);
            this.kind = kind;
            this.status = status || 0;
        }
    }

    async function api(path, options) {
        let response;

        try {
            response = await fetch(API_BASE + path, options);
        } catch (error) {
            console.error("Network error:", error);
            throw new ApiError(
                "network",
                "Cannot reach the Kivo server (" + API_BASE +
                "). Check that the backend and proxy are running.",
                0
            );
        }

        const raw = await response.text().catch(() => "");
        let data = null;

        try {
            data = raw ? JSON.parse(raw) : {};
        } catch (error) {
            data = null;
        }

        if (!response.ok) {
            const message =
                (data && (data.error || data.message)) ||
                raw.slice(0, 200) ||
                response.statusText ||
                "Request failed";
            throw new ApiError("backend", String(message), response.status);
        }

        if (data === null) {
            throw new ApiError(
                "backend",
                "Server returned a non-JSON response.",
                response.status
            );
        }

        return data;
    }

    function describeError(error) {
        if (error instanceof ApiError) {
            if (error.kind === "backend") {
                return "Kivo error" +
                    (error.status ? " (HTTP " + error.status + ")" : "") +
                    ": " + error.message;
            }
            return error.message;
        }
        return "Unexpected error: " + (error && error.message || error);
    }

    /* ---------- UI helpers ---------- */
    function showToast(text) {
        if (!toast) return;
        toast.textContent = text;
        toast.classList.add("show");
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
    }

    function scrollToBottom() {
        main.scrollTop = main.scrollHeight;
    }

    function updateSendState() {
        send.disabled = sending || !input.value.trim();
    }

    function addBubble(text, who) {
        const el = document.createElement("div");
        el.className = "bubble " + who;
        el.textContent = text;
        chat.appendChild(el);
        scrollToBottom();
        return el;
    }

    function renderMessages(messages) {
        chat.innerHTML = "";

        (messages || []).forEach(message => {
            if (!message || !message.text) return;
            addBubble(
                String(message.text),
                message.type === "user" ? "user" : "bot"
            );
        });

        body.classList.toggle("chatting", chat.children.length > 0);
        scrollToBottom();
    }

    function clearChat() {
        chat.innerHTML = "";
        body.classList.remove("chatting");
        input.value = "";
        updateSendState();
    }

    /* ---------- Sidebar and panels ---------- */
    function openSidebar() {
        body.classList.add("sidebar-open");
    }

    function closeSidebarMenu() {
        body.classList.remove("sidebar-open");
    }

    function closePanels() {
        [conversationsPanel, featuresPanel, aboutPanel, donationPanel].forEach(panel => {
            if (panel) panel.classList.remove("show");
        });
    }

    function openPanel(panel) {
        closePanels();
        closeSidebarMenu();
        if (panel) panel.classList.add("show");
    }

    function startNewChat() {
        currentConversationId = null;
        clearChat();
        closePanels();
        closeSidebarMenu();
        input.focus();
    }

    /* ---------- Conversations ---------- */
    function getMessages(conversation) {
        if (Array.isArray(conversation.history)) return conversation.history;
        if (Array.isArray(conversation.messages)) return conversation.messages;
        return [];
    }

    function getConversationTitle(conversation) {
        if (conversation.title) return conversation.title;
        const firstUser = getMessages(conversation).find(
            m => m && m.type === "user" && m.text
        );
        return (firstUser && firstUser.text) || "New chat";
    }

    function getConversationPreview(conversation) {
        const messages = getMessages(conversation);
        const last = messages[messages.length - 1];
        return (last && last.text) || "";
    }

    function toTime(value) {
        if (typeof value === "number") return value;
        const parsed = Date.parse(value);
        return Number.isNaN(parsed) ? 0 : parsed;
    }

    function formatConversationTime(value) {
        if (!value) return "";
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return "";
        return date.toLocaleString([], {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit"
        });
    }

    function selectConversation(conversation) {
        currentConversationId = conversation.id;
        renderMessages(getMessages(conversation));
        input.value = "";
        updateSendState();
        closePanels();
    }

    function renderConversations() {
        if (!conversationList) return;
        conversationList.innerHTML = "";

        if (!conversations.length) {
            const empty = document.createElement("div");
            empty.className = "conversation-empty";
            empty.textContent = "No conversations yet.";
            conversationList.appendChild(empty);
            return;
        }

        const sorted = [...conversations].sort(
            (a, b) => toTime(b.updatedAt) - toTime(a.updatedAt)
        );

        sorted.forEach(conversation => {
            const row = document.createElement("div");
            row.className = "conversation-row";
            row.setAttribute("role", "button");
            row.tabIndex = 0;

            if (conversation.id === currentConversationId) {
                row.classList.add("current");
            }

            const content = document.createElement("div");
            content.className = "conversation-row-main";

            const title = document.createElement("div");
            title.className = "conversation-row-title";
            title.textContent = getConversationTitle(conversation);

            const preview = document.createElement("div");
            preview.className = "conversation-row-preview";
            preview.textContent = getConversationPreview(conversation);

            const time = document.createElement("div");
            time.className = "conversation-row-time";
            time.textContent = formatConversationTime(conversation.updatedAt);

            const actions = document.createElement("div");
            actions.className = "conversation-row-actions";

            const deleteButton = document.createElement("button");
            deleteButton.type = "button";
            deleteButton.className = "conversation-delete";
            deleteButton.textContent = "Delete";
            deleteButton.setAttribute("aria-label", "Delete conversation");

            deleteButton.addEventListener("click", event => {
                event.stopPropagation();
                deleteConversation(conversation.id);
            });

            content.appendChild(title);
            content.appendChild(preview);
            actions.appendChild(deleteButton);

            row.appendChild(content);
            row.appendChild(time);
            row.appendChild(actions);

            row.addEventListener("click", () => selectConversation(conversation));
            row.addEventListener("keydown", event => {
                if (event.target === row && event.key === "Enter") {
                    selectConversation(conversation);
                }
            });

            conversationList.appendChild(row);
        });
    }

    async function loadConversations() {
        try {
            const data = await api("/conversations");
            conversations = Array.isArray(data.conversations)
                ? data.conversations
                : [];
            renderConversations();
        } catch (error) {
            console.error("Conversation load error:", error);
            showToast("Could not load conversations: " + describeError(error));
        }
        return conversations;
    }

    async function openConversations() {
        openPanel(conversationsPanel);
        await loadConversations();
    }

    async function deleteConversation(id) {
        const conversation = conversations.find(item => item.id === id);
        const title = conversation
            ? getConversationTitle(conversation)
            : "this conversation";

        if (!window.confirm('Delete "' + title + '"?')) return;

        try {
            const data = await api(
                "/conversations/" + encodeURIComponent(id),
                { method: "DELETE" }
            );

            if (data && data.success === false) {
                throw new ApiError("backend", "Delete was not confirmed.", 200);
            }

            if (currentConversationId === id) {
                currentConversationId = null;
                clearChat();
            }

            await loadConversations();
            showToast("Conversation deleted.");
        } catch (error) {
            console.error("Delete conversation error:", error);
            showToast("Could not delete: " + describeError(error));
        }
    }

    /* ---------- Chat ---------- */
    async function sendKivoMessage(text) {
        if (sending) return;

        sending = true;
        updateSendState();

        const thinking = addBubble("Thinking...", "bot");

        try {
            const data = await api("/chat", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    message: text,
                    ...(currentConversationId &&
                    conversations.some(
                        c => c.id === currentConversationId
                    )
                        ? { conversationId: currentConversationId }
                        : {})
                })
            });

            if (data.conversationId) {
                currentConversationId = data.conversationId;
            }

            thinking.remove();

            if (
                Array.isArray(data.history) &&
                data.history.length
            ) {
                renderMessages(data.history);
            } else if (
                typeof data.reply === "string" &&
                data.reply
            ) {
                addBubble(data.reply, "bot");
            } else {
                throw new Error(
                    "Server response did not contain a reply."
                );
            }

            await loadConversations();

        } catch (error) {
            console.error("Kivo chat error:", error);

            if (thinking) {
                thinking.remove();
            }

            addBubble(
                "Kivo error: " +
                (
                    error && error.message
                        ? error.message
                        : String(error)
                ),
                "bot"
            );

        } finally {
            sending = false;
            updateSendState();
        }
    }

    /* ---------- Copy ---------- */
    function legacyCopy(text) {
        const area = document.createElement("textarea");
        area.value = text;
        area.setAttribute("readonly", "");
        area.style.cssText = "position:fixed;top:0;left:0;opacity:0;";
        document.body.appendChild(area);
        area.select();
        const ok = document.execCommand("copy");
        area.remove();
        if (!ok) throw new Error("copy failed");
    }

    async function copyDonationAddress() {
        const text = donationAddress ? donationAddress.textContent.trim() : "";

        if (!text || text === PLACEHOLDER_ADDRESS) {
            showToast("Donation address is not set yet.");
            return;
        }

        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
            } else {
                legacyCopy(text);
            }
            showToast("Address copied.");
        } catch (error) {
            try {
                legacyCopy(text);
                showToast("Address copied.");
            } catch (fallbackError) {
                showToast("Could not copy the address.");
            }
        }
    }

    /* ---------- Event wiring (each element independent) ---------- */
    function on(element, eventName, handler, label) {
        if (!element) {
            console.warn("Kivo: element not found, skipped:", label);
            return;
        }
        element.addEventListener(eventName, handler);
    }

    function closeOnBackdrop(panel) {
        on(panel, "click", event => {
            if (event.target === panel) closePanels();
        }, "panel backdrop");
    }

    form.addEventListener("submit", event => {
        event.preventDefault();

        const text = input.value.trim();
        if (!text || sending) return;

        body.classList.add("chatting");
        addBubble(text, "user");
        input.value = "";
        updateSendState();

        sendKivoMessage(text);
    });

    input.addEventListener("input", updateSendState);

    on(menuButton, "click", openSidebar, "menu");
    on(closeSidebar, "click", closeSidebarMenu, "closeSidebar");
    on(sidebarOverlay, "click", closeSidebarMenu, "sidebarOverlay");
    on(newChatButton, "click", startNewChat, "newChat");
    on(sidebarNewChat, "click", startNewChat, "sidebarNewChat");

    on(historyItem, "click", openConversations, "historyItem");
    on(closeConversations, "click", closePanels, "closeConversations");

    on(donationItem, "click", () => openPanel(donationPanel), "donationItem");
    on(closeDonation, "click", closePanels, "closeDonation");
    on(copyButton, "click", copyDonationAddress, "copyDonationAddress");

    on(featuresItem, "click", () => openPanel(featuresPanel), "featuresItem");
    on(closeFeatures, "click", closePanels, "closeFeatures");
    on(settingsItem, "click", () => openPanel(aboutPanel), "settingsItem");
    on(closeAbout, "click", closePanels, "closeSettings");

    closeOnBackdrop(conversationsPanel);
    closeOnBackdrop(featuresPanel);
    closeOnBackdrop(aboutPanel);
    closeOnBackdrop(donationPanel);

    document.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            closePanels();
            closeSidebarMenu();
        }
    });

    updateSendState();
    checkAIStatus();
    setInterval(checkAIStatus, 10000);
})();
