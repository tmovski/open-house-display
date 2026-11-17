package com.serafimovski.openhousedisplay

/** Pure helpers for exported files, kept free of Android types for unit testing. */
object ExportFiles {
    const val DEFAULT_NAME = "open-house-sign-ins.csv"
    private const val MAX_LENGTH = 80

    /** Turns a name from JavaScript into a safe file name: no paths, no odd characters, always .csv. */
    fun safeCsvName(requested: String?): String {
        val base = requested
            ?.substringAfterLast('/')
            ?.substringAfterLast('\\')
            ?.removeSuffix(".csv")
            ?.replace(Regex("[^A-Za-z0-9._-]"), "-")
            ?.replace(Regex("-{2,}"), "-")
            ?.trim('.', '-')
            ?.take(MAX_LENGTH - 4)
            .orEmpty()
        return if (base.isEmpty()) DEFAULT_NAME else "$base.csv"
    }

    /** Excel needs a byte-order mark to read UTF-8 names like "José" correctly. */
    fun withByteOrderMark(csv: String): String = if (csv.startsWith("\uFEFF")) csv else "\uFEFF$csv"
}
