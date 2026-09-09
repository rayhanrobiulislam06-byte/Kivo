// @ts-nocheck

const chat = document.getElementById("chat");
const messageInput = document.getElementById("messageInput");
const sendButton = document.getElementById("sendButton");
const newChatButton = document.getElementById("newChatButton");
const menuButton = document.getElementById("menuButton");
const sidebar = document.getElementById("sidebar");
const closeSidebarButton = document.getElementById("closeSidebar");
const sidebarOverlay = document.getElementById("sidebarOverlay");
const sidebarNewChat = document.getElementById("sidebarNewChat");
const conversationList = document.getElementById("conversationList");
const donateButton = document.getElementById("donateButton");

const donationModal =
    document.getElementById("donationModal");

const closeDonationButton =
    document.getElementById("closeDonationButton");

const donationAmount =
    document.getElementById("donationAmount");

const copyDonationAddress =
    document.getElementById("copyDonationAddress");

const donationContinueButton =
    document.getElementById("donationContinueButton");

const donationAddress =
    document.getElementById("donationAddress");

const donationStatus =
    document.getElementById("donationStatus");

/* =========================
   BACKEND
========================= */

const API_BASE = "http://192.168.1.101:3001";

const CHAT_URL = API_BASE + "/chat";
const CONVERSATIONS_URL = API_BASE + "/conversations";

/* =========================
   STATE
========================= */

let conversations = [];

let currentConversationId =
    localStorage.getItem("kivoCurrentConversationId");

let isSending = false;

/* =========================
   CURRENT CONVERSATION
========================= */

function getCurrentConversation() {
    return conversations.find(
        conversation =>
            conversation.id === currentConversationId
    );
}

/* =========================
   SAVE CURRENT ID
========================= */

function saveCurrentConversation() {
    if (currentConversationId) {
        localStorage.setItem(
            "kivoCurrentConversationId",
            currentConversationId
        );
    } else {
        localStorage.removeItem(
            "kivoCurrentConversationId"
        );
    }
}

/* =========================
   LOAD CONVERSATIONS
========================= */

async function loadConversations() {
    try {
        const response =
            await fetch(CONVERSATIONS_URL);

        if (!response.ok) {
            throw new Error(
                "Could not load conversations"
            );
        }

        const data =
            await response.json();

        conversations =
            Array.isArray(data.conversations)
                ? data.conversations
                : [];

        conversations =
            conversations.filter(
                conversation =>
                    conversation.messages &&
                    conversation.messages.length > 0
            );

        if (
            currentConversationId &&
            !getCurrentConversation()
        ) {
            currentConversationId = null;
            saveCurrentConversation();
        }

        renderConversationList();

        if (currentConversationId) {
            await openConversation(
                currentConversationId,
                false
            );
        } else {
            renderMessages();
        }

    } catch (error) {
        console.error(
            "History load error:",
            error
        );

        conversations = [];
        currentConversationId = null;

        saveCurrentConversation();
        renderConversationList();
        renderMessages();
    }
}

/* =========================
   NEW CHAT
========================= */

function startNewChat() {
    currentConversationId = null;

    saveCurrentConversation();

    renderMessages();

    closeSidebar();

    messageInput.value = "";
    messageInput.style.height = "auto";

    messageInput.focus();
}

/* =========================
   OPEN CONVERSATION
========================= */

async function openConversation(
    conversationId,
    closeMenu = true
) {
    try {
        const response =
            await fetch(
                `${CONVERSATIONS_URL}/${encodeURIComponent(conversationId)}`
            );

        if (!response.ok) {
            throw new Error(
                "Conversation not found"
            );
        }

        const data =
            await response.json();

        const conversation =
            data.conversation;

        if (!conversation) {
            throw new Error(
                "Conversation missing"
            );
        }

        const index =
            conversations.findIndex(
                item =>
                    item.id === conversation.id
            );

        if (index >= 0) {
            conversations[index] =
                conversation;
        } else {
            conversations.unshift(
                conversation
            );
        }

        currentConversationId =
            conversation.id;

        saveCurrentConversation();

        renderMessages();
        renderConversationList();

        if (closeMenu) {
            closeSidebar();
        }

    } catch (error) {
        console.error(
            "Open conversation error:",
            error
        );
    }
}

/* =========================
   MESSAGE UI
========================= */

function addMessageToUI(
    text,
    type
) {
    const message =
        document.createElement("div");

    message.className =
        "message " + type;

    const content =
        document.createElement("div");

    content.className =
        "message-content";

    content.textContent =
        text;

    message.appendChild(content);

    chat.appendChild(message);
}

/* =========================
   RENDER MESSAGES
========================= */

function renderMessages() {
    chat.innerHTML = "";

    const conversation =
        getCurrentConversation();

    if (
        !conversation ||
        !conversation.messages ||
        conversation.messages.length === 0
    ) {
        chat.innerHTML = `
            <div
                id="welcome"
                class="welcome"
            >
                <div class="kivo-icon">
                    K
                </div>

                <h1>
                    How can I help you?
                </h1>
            </div>
        `;

        return;
    }

    conversation.messages.forEach(
        message => {
            addMessageToUI(
                message.text,
                message.type
            );
        }
    );

    requestAnimationFrame(
        () => {
            chat.scrollTop =
                chat.scrollHeight;
        }
    );
}
/* =========================
   SHOW LOADING
========================= */

function showLoading() {

    removeLoading();

    const message =
        document.createElement("div");

    message.className =
        "message bot";

    message.id =
        "loadingMessage";

    const content =
        document.createElement("div");

    content.className =
        "message-content";

    content.textContent =
        "Thinking...";

    message.appendChild(
        content
    );

    chat.appendChild(
        message
    );

    requestAnimationFrame(
        () => {
            chat.scrollTop =
                chat.scrollHeight;
        }
    );
}


/* =========================
   REMOVE LOADING
========================= */

function removeLoading() {

    const loading =
        document.getElementById(
            "loadingMessage"
        );

    if (loading) {
        loading.remove();
    }
}


/* =========================
   SEND MESSAGE
========================= */

async function sendMessage() {

    if (isSending) {
        return;
    }

    const text =
        messageInput.value.trim();

    if (!text) {
        return;
    }

    isSending = true;

    sendButton.disabled = true;

    const welcome =
        document.getElementById(
            "welcome"
        );

    if (welcome) {
        welcome.remove();
    }

    addMessageToUI(
        text,
        "user"
    );

    messageInput.value = "";

    messageInput.style.height =
        "auto";

    showLoading();

    try {

        const response =
            await fetch(
                CHAT_URL,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            message: text,
                            conversationId:
                                currentConversationId
                        })
                }
            );

        const data =
            await response.json();

        if (!response.ok) {

            throw new Error(
                data.error ||
                "Kivo request failed"
            );
        }

        removeLoading();

        currentConversationId =
            data.conversationId;

        saveCurrentConversation();

        await openConversation(
            currentConversationId,
            false
        );

    } catch (error) {

        console.error(
            "Kivo chat error:",
            error
        );

        removeLoading();

        addMessageToUI(
            "Sorry, Kivo could not connect to the server.",
            "bot"
        );

    } finally {

        isSending = false;

        sendButton.disabled = false;

        messageInput.focus();
    }
}


/* =========================
   DELETE CONVERSATION
========================= */

async function deleteConversation(
    conversationId
) {

    const conversation =
        conversations.find(
            item =>
                item.id ===
                conversationId
        );

    if (!conversation) {
        return;
    }

    const confirmed =
        confirm(
            `Delete "${conversation.title}"?`
        );

    if (!confirmed) {
        return;
    }

    try {

        const response =
            await fetch(
                `${CONVERSATIONS_URL}/${encodeURIComponent(conversationId)}`,
                {
                    method: "DELETE"
                }
            );

        const data =
            await response.json();

        if (!response.ok) {

            throw new Error(
                data.error ||
                "Delete failed"
            );
        }

        conversations =
            conversations.filter(
                item =>
                    item.id !==
                    conversationId
            );

        if (
            currentConversationId ===
            conversationId
        ) {

            currentConversationId =
                null;

            saveCurrentConversation();

            renderMessages();
        }

        renderConversationList();

    } catch (error) {

        console.error(
            "Delete error:",
            error
        );

        alert(
            "Could not delete this conversation."
        );
    }
}


/* =========================
   RENDER SIDEBAR
========================= */

function renderConversationList() {

    conversationList.innerHTML = "";

    conversations.forEach(
        conversation => {

            if (
                !conversation.messages ||
                conversation.messages.length === 0
            ) {
                return;
            }

            const row =
                document.createElement(
                    "div"
                );

            row.className =
                "conversation-row";

            if (
                conversation.id ===
                currentConversationId
            ) {
                row.classList.add(
                    "active"
                );
            }

            const item =
                document.createElement(
                    "div"
                );

            item.className =
                "conversation-item";

            item.textContent =
                conversation.title;

            item.title =
                conversation.title;

            item.addEventListener(
                "click",
                () => {

                    openConversation(
                        conversation.id
                    );

                }
            );

            const menu =
                document.createElement(
                    "button"
                );

            menu.className =
                "conversation-menu";

            menu.textContent =
                "⋯";

            menu.setAttribute(
                "aria-label",
                "Conversation options"
            );

            menu.addEventListener(
                "click",
                event => {

                    event.stopPropagation();

                    showDeleteMenu(
                        row,
                        conversation.id
                    );

                }
            );

            row.appendChild(item);

            row.appendChild(menu);

            conversationList.appendChild(
                row
            );
        }
    );
}


/* =========================
   DELETE MENU
========================= */

function showDeleteMenu(
    row,
    conversationId
) {

    document
        .querySelectorAll(
            ".delete-menu"
        )
        .forEach(
            menu => menu.remove()
        );

    const menu =
        document.createElement(
            "div"
        );

    menu.className =
        "delete-menu";

    const deleteButton =
        document.createElement(
            "button"
        );

    deleteButton.className =
        "delete-button";

    deleteButton.textContent =
        "Delete";

    deleteButton.addEventListener(
        "click",
        event => {

            event.stopPropagation();

            menu.remove();

            deleteConversation(
                conversationId
            );
        }
    );

    menu.appendChild(
        deleteButton
    );

    row.appendChild(
        menu
    );
}


/* =========================
   SIDEBAR
========================= */

function openSidebar() {

    sidebar.classList.add(
        "open"
    );

    sidebarOverlay.classList.add(
        "open"
    );

    renderConversationList();
}


function closeSidebar() {

    sidebar.classList.remove(
        "open"
    );

    sidebarOverlay.classList.remove(
        "open"
    );

    document
        .querySelectorAll(
            ".delete-menu"
        )
        .forEach(
            menu => menu.remove()
        );
}


/* =========================
   SIDEBAR EVENTS
========================= */

if (menuButton) {

    menuButton.addEventListener(
        "click",
        openSidebar
    );
}


if (closeSidebarButton) {

    closeSidebarButton.addEventListener(
        "click",
        closeSidebar
    );
}


if (sidebarOverlay) {

    sidebarOverlay.addEventListener(
        "click",
        closeSidebar
    );
}


/* =========================
   NEW CHAT
========================= */

if (newChatButton) {

    newChatButton.addEventListener(
        "click",
        startNewChat
    );
}


if (sidebarNewChat) {

    sidebarNewChat.addEventListener(
        "click",
        startNewChat
    );
}


/* =========================
   DONATE
========================= */

function openDonationModal() {

    if (!donationModal) {
        return;
    }

    donationModal.classList.add("open");
    donationModal.setAttribute(
        "aria-hidden",
        "false"
    );

    if (donationStatus) {
        donationStatus.textContent = "";
    }

    if (donationAmount) {
        donationAmount.focus();
    }
}

function closeDonationModal() {

    if (!donationModal) {
        return;
    }

    donationModal.classList.remove("open");
    donationModal.setAttribute(
        "aria-hidden",
        "true"
    );
}

if (donateButton) {
    donateButton.addEventListener(
        "click",
        openDonationModal
    );
}

if (closeDonationButton) {
    closeDonationButton.addEventListener(
        "click",
        closeDonationModal
    );
}

if (donationModal) {
    donationModal.addEventListener(
        "click",
        event => {

            if (event.target === donationModal) {
                closeDonationModal();
            }

        }
    );
}

document.addEventListener(
    "keydown",
    event => {

        if (
            event.key === "Escape" &&
            donationModal &&
            donationModal.classList.contains("open")
        ) {
            closeDonationModal();
        }

    }
);

/* =========================
   DONATION ACTIONS
========================= */

if (copyDonationAddress) {
    copyDonationAddress.addEventListener(
        "click",
        async () => {

            const address =
                donationAddress?.textContent?.trim();

            if (
                !address ||
                address === "Wallet address will appear here"
            ) {
                if (donationStatus) {
                    donationStatus.textContent =
                        "Receiving address is not configured yet.";
                }
                return;
            }

            try {
                await navigator.clipboard.writeText(address);

                if (donationStatus) {
                    donationStatus.textContent =
                        "Address copied.";
                }

            } catch {
                if (donationStatus) {
                    donationStatus.textContent =
                        "Could not copy the address.";
                }
            }
        }
    );
}

if (donationContinueButton) {
    donationContinueButton.addEventListener(
        "click",
        () => {

            const value =
                donationAmount?.value?.trim() || "";

            const amount =
                Number(value);

            if (
                !value ||
                !Number.isFinite(amount) ||
                amount <= 0
            ) {
                if (donationStatus) {
                    donationStatus.textContent =
                        "Please enter a valid donation amount.";
                }

                donationAmount?.focus();
                return;
            }

            if (donationStatus) {
                donationStatus.textContent =
                    "Amount accepted. Payment setup is not active yet.";
            }
        }
    );
}

/* =========================
   SEND BUTTON
========================= */

if (sendButton) {

    sendButton.addEventListener(
        "click",
        event => {

            event.preventDefault();

            sendMessage();
        }
    );
}


/* =========================
   ENTER TO SEND
========================= */

if (messageInput) {

    messageInput.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Enter" &&
                !event.shiftKey
            ) {

                event.preventDefault();

                sendMessage();
            }
        }
    );


    messageInput.addEventListener(
        "input",
        () => {

            messageInput.style.height =
                "auto";

            messageInput.style.height =
                Math.min(
                    messageInput.scrollHeight,
                    140
                ) + "px";
        }
    );
}


/* =========================
   CLOSE DELETE MENUS
========================= */

document.addEventListener(
    "click",
    event => {

        if (
            !event.target.closest(
                ".conversation-menu"
            ) &&
            !event.target.closest(
                ".delete-menu"
            )
        ) {

            document
                .querySelectorAll(
                    ".delete-menu"
                )
                .forEach(
                    menu => menu.remove()
                );
        }
    }
);


/* =========================
   START APP
========================= */

loadConversations();

/* =========================
   ACODE KEYBOARD FIX
========================= */

(function () {

    const inputArea =
        document.querySelector(".input-area");

    if (!inputArea) {
        return;
    }

    function updateInputPosition() {

        if (!window.visualViewport) {
            return;
        }

        const viewport =
            window.visualViewport;

        const keyboardHeight =
            Math.max(
                0,
                window.innerHeight -
                viewport.height -
                viewport.offsetTop
            );

        inputArea.style.transform =
            keyboardHeight > 0
                ? `translateY(-${keyboardHeight}px)`
                : "translateY(0)";
    }

    window.visualViewport.addEventListener(
        "resize",
        updateInputPosition
    );

    window.visualViewport.addEventListener(
        "scroll",
        updateInputPosition
    );

    messageInput.addEventListener(
        "focus",
        () => {

            setTimeout(
                updateInputPosition,
                100
            );

            setTimeout(
                updateInputPosition,
                300
            );

            setTimeout(
                updateInputPosition,
                600
            );

        }
    );

    messageInput.addEventListener(
        "blur",
        () => {

            setTimeout(
                updateInputPosition,
                100
            );

        }
    );

    updateInputPosition();

})();