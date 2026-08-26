package com.digitalalbum.musicbridge

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.Signature
import java.security.spec.ECGenParameterSpec

object KeystoreSigner {
    private const val alias = "music_bridge_signing_key"
    private fun keyStore(): KeyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
    private fun ensureKey() {
        if (keyStore().containsAlias(alias)) return
        KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_EC, "AndroidKeyStore").apply {
            initialize(KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_SIGN or KeyProperties.PURPOSE_VERIFY)
                .setAlgorithmParameterSpec(ECGenParameterSpec("secp256r1"))
                .setDigests(KeyProperties.DIGEST_SHA256)
                .build())
            generateKeyPair()
        }
    }
    fun publicKey(): String {
        ensureKey()
        return Base64.encodeToString(keyStore().getCertificate(alias).publicKey.encoded, Base64.NO_WRAP)
    }
    fun sign(value: String): String {
        ensureKey()
        val signature = Signature.getInstance("SHA256withECDSA")
        signature.initSign(keyStore().getKey(alias, null) as java.security.PrivateKey)
        signature.update(value.toByteArray(Charsets.UTF_8))
        return Base64.encodeToString(signature.sign(), Base64.NO_WRAP)
    }
}
