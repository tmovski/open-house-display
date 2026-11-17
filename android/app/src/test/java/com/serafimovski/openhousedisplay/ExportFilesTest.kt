package com.serafimovski.openhousedisplay

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ExportFilesTest {

    @Test
    fun keepsNormalNames() {
        assertEquals("open-house-sign-ins-2026-09-20.csv", ExportFiles.safeCsvName("open-house-sign-ins-2026-09-20.csv"))
    }

    @Test
    fun stripsPathsAndOddCharacters() {
        assertEquals("passwd.csv", ExportFiles.safeCsvName("../../etc/passwd"))
        assertEquals("sign-ins.csv", ExportFiles.safeCsvName("C:\\temp\\sign ins"))
        assertEquals("a-b.csv", ExportFiles.safeCsvName("a<>:\"|?*b.csv"))
    }

    @Test
    fun fallsBackWhenEmpty() {
        assertEquals(ExportFiles.DEFAULT_NAME, ExportFiles.safeCsvName(null))
        assertEquals(ExportFiles.DEFAULT_NAME, ExportFiles.safeCsvName("..."))
        assertEquals(ExportFiles.DEFAULT_NAME, ExportFiles.safeCsvName(".csv"))
    }

    @Test
    fun capsLength() {
        val name = ExportFiles.safeCsvName("x".repeat(500))
        assertEquals(80, name.length)
        assertTrue(name.endsWith(".csv"))
    }

    @Test
    fun addsByteOrderMarkOnce() {
        assertEquals("\uFEFFa,b", ExportFiles.withByteOrderMark("a,b"))
        assertEquals("\uFEFFa,b", ExportFiles.withByteOrderMark("\uFEFFa,b"))
    }
}
