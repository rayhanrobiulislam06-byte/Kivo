package com.kivo.app

/** The on-device model Kivo runs (Gemma 4 E2B, LiteRT-LM). The URL is pinned to one exact revision. */
object ModelConfig {
    const val NAME = "gemma-4-E2B-it.litertlm"
    const val URL =
        "https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/" +
            "3d48132a00cf76de57d926de30f5c5c5ed9b8c0d/gemma-4-E2B-it.litertlm"
    const val SHA256 = "181938105e0eefd105961417e8da75903eacda102c4fce9ce90f50b97139a63c"
    const val TOTAL_BYTES = 2_588_147_712L
    const val FREE_SPACE_MARGIN = 200L * 1024 * 1024
    const val MIN_PICKED_BYTES = 100L * 1024 * 1024
}
