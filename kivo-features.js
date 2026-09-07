/* Kivo Feature Pack V1
   Safe frontend enhancements
*/

(() => {
    "use strict";

    const API_BASE =
        window.KIVO_API_BASE ||
        "http://192.168.1.102:3000";

    const MEMORY_URL =
        API_BASE + "/memory";

    window.KivoFeatures = {

        async getMemories() {
            const response =
                await fetch(MEMORY_URL);

            if (!response.ok) {
                throw new Error(
                    "Could not load memories"
                );
            }

            return await response.json();
        },

        async saveMemory(key, value) {
            const response =
                await fetch(
                    MEMORY_URL,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type":
                                "application/json"
                        },
                        body: JSON.stringify({
                            key,
                            value
                        })
                    }
                );

            if (!response.ok) {
                throw new Error(
                    "Could not save memory"
                );
            }

            return await response.json();
        },

        async deleteMemory(key) {
            const response =
                await fetch(
                    `${MEMORY_URL}/${encodeURIComponent(key)}`,
                    {
                        method: "DELETE"
                    }
                );

            if (!response.ok) {
                throw new Error(
                    "Could not delete memory"
                );
            }

            return await response.json();
        }

    };

    console.log(
        "Kivo Feature Pack V1 loaded"
    );
})();

/* =========================
   MEMORY UI V1
========================= */

(() => {
    "use strict";

    const panel =
        document.getElementById(
            "kivoFeaturePanel"
        );

    const closeButton =
        document.getElementById(
            "closeKivoFeatures"
        );

    const keyInput =
        document.getElementById(
            "memoryKey"
        );

    const valueInput =
        document.getElementById(
            "memoryValue"
        );

    const saveButton =
        document.getElementById(
            "saveMemoryButton"
        );

    const memoryList =
        document.getElementById(
            "memoryList"
        );

    if (
        !panel ||
        !closeButton ||
        !keyInput ||
        !valueInput ||
        !saveButton ||
        !memoryList
    ) {
        console.warn(
            "Kivo Memory UI elements not found."
        );
        return;
    }

    async function loadMemoryUI() {

        memoryList.innerHTML =
            "<div>Loading memories...</div>";

        try {

            const data =
                await window.KivoFeatures
                    .getMemories();

            const memories =
                Array.isArray(data.memories)
                    ? data.memories
                    : [];

            memoryList.innerHTML = "";

            if (!memories.length) {

                memoryList.innerHTML =
                    "<div>No memories saved.</div>";

                return;
            }

            memories.forEach(memory => {

                const item =
                    document.createElement(
                        "div"
                    );

                item.className =
                    "memory-item";

                const content =
                    document.createElement(
                        "div"
                    );

                content.className =
                    "memory-content";

                const key =
                    document.createElement(
                        "div"
                    );

                key.className =
                    "memory-key";

                key.textContent =
                    memory.key;

                const value =
                    document.createElement(
                        "div"
                    );

                value.className =
                    "memory-value";

                value.textContent =
                    memory.value;

                content.appendChild(key);
                content.appendChild(value);

                const deleteButton =
                    document.createElement(
                        "button"
                    );

                deleteButton.className =
                    "memory-delete";

                deleteButton.textContent =
                    "×";

                deleteButton.title =
                    "Delete memory";

                deleteButton.addEventListener(
                    "click",
                    async () => {

                        try {

                            await window
                                .KivoFeatures
                                .deleteMemory(
                                    memory.key
                                );

                            await loadMemoryUI();

                        } catch (error) {

                            console.error(
                                "Memory delete error:",
                                error
                            );

                            alert(
                                "Could not delete memory."
                            );
                        }
                    }
                );

                item.appendChild(content);
                item.appendChild(deleteButton);

                memoryList.appendChild(item);
            });

        } catch (error) {

            console.error(
                "Memory load error:",
                error
            );

            memoryList.innerHTML =
                "<div>Could not load memories.</div>";
        }
    }

    async function saveMemoryFromUI() {

        const key =
            keyInput.value.trim();

        const value =
            valueInput.value.trim();

        if (!key || !value) {
            return;
        }

        saveButton.disabled = true;

        try {

            await window
                .KivoFeatures
                .saveMemory(
                    key,
                    value
                );

            keyInput.value = "";
            valueInput.value = "";

            await loadMemoryUI();

        } catch (error) {

            console.error(
                "Memory save error:",
                error
            );

            alert(
                "Could not save memory."
            );

        } finally {

            saveButton.disabled = false;
        }
    }

    saveButton.addEventListener(
        "click",
        saveMemoryFromUI
    );

    closeButton.addEventListener(
        "click",
        () => {
            panel.hidden = true;
        }
    );

    window.openKivoFeatures =
        async function () {

            panel.hidden = false;

            await loadMemoryUI();
        };

})();

/* =========================
   FEATURES MENU BUTTON
========================= */

function initKivoFeaturesButton() {

    const conversationList =
        document.getElementById("conversationList");

    if (!conversationList) {
        return;
    }

    if (
        document.getElementById(
            "kivoFeaturesButton"
        )
    ) {
        return;
    }

    const button =
        document.createElement("button");

    button.id =
        "kivoFeaturesButton";

    button.type =
        "button";

    button.className =
        "new-chat-button";

    button.textContent =
        "⚙ Features";

    button.addEventListener(
        "click",
        async () => {

            if (
                typeof window.openKivoFeatures ===
                "function"
            ) {
                await window.openKivoFeatures();
            }
        }
    );

    conversationList.parentNode.insertBefore(
        button,
        conversationList
    );

    console.log(
        "Kivo Features button initialized"
    );
}


if (document.readyState === "loading") {

    document.addEventListener(
        "DOMContentLoaded",
        initKivoFeaturesButton
    );

} else {

    initKivoFeaturesButton();

}
