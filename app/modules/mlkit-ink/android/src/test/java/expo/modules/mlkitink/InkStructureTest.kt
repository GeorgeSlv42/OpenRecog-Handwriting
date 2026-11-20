package expo.modules.mlkitink

import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Test

class InkStructureTest {
  private fun trace(id: String, vararg xy: Pair<Double, Double>, time: Double = 0.0) =
    InkTrace(id, xy.mapIndexed { index, (x, y) -> InkSample(x, y, time + index) })

  private fun letter(id: String, x: Double, y: Double = 0.0, time: Double = 0.0) =
    trace(id, x to y, (x + 4) to (y + 20), (x + 8) to y, time = time)

  @Test fun `word gaps link while distant phrases and rows stay separate`() {
    val layout = structureInk(listOf(letter("a", 0.0), letter("b", 10.0), letter("c", 35.0), letter("d", 150.0), letter("e", 0.0, 60.0)))
    assertEquals(listOf(listOf("a", "b"), listOf("c"), listOf("d"), listOf("e")), layout.words.map { word -> word.strokes.map { it.id } })
    assertSame(layout.words[0], layout.words[1].previous)
    assertNull(layout.words[2].previous)
    assertNull(layout.words[3].previous)
  }

  @Test fun `late dot stays attached and stroke time order is preserved`() {
    val layout = structureInk(listOf(letter("a", 0.0), letter("b", 10.0), trace("dot", 14.0 to -5.0, 14.5 to -4.0, time = 500.0)))
    assertEquals(1, layout.words.size)
    assertEquals(listOf("a", "b", "dot"), layout.words.single().strokes.map { it.id })
  }

  @Test fun `local text height links a tall initial to a nearby word`() {
    val layout = structureInk(listOf(
      trace("initial", 0.0 to 0.0, 0.0 to 40.0),
      letter("a", 35.0, 20.0, 100.0), letter("b", 45.0, 20.0, 110.0), letter("c", 55.0, 20.0, 120.0),
    ))
    assertEquals(2, layout.words.size)
    assertSame(layout.words[0], layout.words[1].previous)
  }

  @Test fun `horizontal gaps use local text scale despite large neighbors and page median`() {
    for (scale in listOf(0.5, 1.0, 3.0)) {
      val ink = listOf(letter("a", 0.0, 60.0), letter("b", 30.0, 60.0), letter("c", 83.0, 60.0)) +
        (0..6).map { trace("large$it", (300.0 + it * 20) to 0.0,
          (304.0 + it * 20) to 80.0, (308.0 + it * 20) to 0.0) }
      val layout = recognitionRuns(structureInk(ink.map { s -> s.copy(points = s.points.map {
        it.copy(x = it.x * scale - 100, y = it.y * scale - 100)
      }) }))
      val first = layout.words.single { word -> word.strokes.any { it.id == "a" } }
      assertEquals(listOf("a", "b"), first.strokes.map { it.id })
      val separate = layout.words.single { word -> word.strokes.any { it.id == "c" } }
      assertNull(separate.previous)
    }
  }

  @Test fun `large text keeps wide word spaces despite smaller text elsewhere`() {
    val ink = (0..7).map { letter("small$it", it * 10.0) } + listOf(
      trace("large1", 300.0 to 200.0, 304.0 to 280.0, 308.0 to 200.0),
      trace("large2", 398.0 to 200.0, 402.0 to 280.0, 406.0 to 200.0),
    )
    val runs = recognitionRuns(structureInk(ink))
    assertTrue(runs.words.any { it.strokes.map { stroke -> stroke.id } == listOf("large1", "large2") })
  }

  @Test fun `large letters stay in one word beside much smaller handwriting`() {
    val small = (0..7).map { letter("small$it", it * 10.0) }
    val large = listOf(
      trace("stem", 200.0 to 200.0, 200.0 to 300.0, time = 100.0),
      trace("loop", 200.0 to 200.0, 240.0 to 200.0, 240.0 to 250.0, 200.0 to 250.0, time = 110.0),
      trace("i", 270.0 to 245.0, 270.0 to 325.0, time = 120.0),
      trace("dot", 270.0 to 210.0, time = 130.0),
      trace("z", 300.0 to 240.0, 350.0 to 240.0, 300.0 to 310.0, 350.0 to 310.0, time = 140.0),
    )
    val layout = structureInk(small + large)
    assertEquals(layout.words.map { word -> word.strokes.map { it.id } }.toString(), 2, layout.words.size)
    assertEquals(large.map { it.id }, layout.words[1].strokes.map { it.id })
    assertNull(layout.words[1].previous)
  }

  @Test fun `an aligned next row continues the same chain`() = runBlocking {
    val layout = structureInk(listOf(letter("a", 0.0, time = 0.0), letter("b", 30.0, time = 10.0),
      letter("c", 2.0, 40.0, 100.0), letter("d", 32.0, 40.0, 110.0)))
    assertSame(layout.words[1], layout.words[2].previous)
    val result = recognizeStructuredInk(layout) { strokes, _ -> listOf(strokes.first().id) }
    @Suppress("UNCHECKED_CAST") val words = result["words"] as List<Map<String, Any?>>
    assertEquals(1, words.count { it["prev"] == null })
    assertEquals(words[2]["id"], words[1]["next"])
    assertEquals(words[1]["id"], words[2]["prev"])
  }

  @Test fun `separate columns and large paragraph gaps do not wrap`() {
    val columns = structureInk(listOf(letter("a", 0.0), letter("b", 30.0),
      letter("c", 150.0, 40.0, 100.0), letter("d", 180.0, 40.0, 110.0)))
    assertNull(columns.words[2].previous)
    val paragraphs = structureInk(listOf(letter("a", 0.0), letter("b", 30.0),
      letter("c", 0.0, 90.0, 100.0), letter("d", 30.0, 90.0, 110.0)))
    assertNull(paragraphs.words[2].previous)
  }

  @Test fun `side by side blocks each wrap and keep recognition context independent`() = runBlocking {
    val layout = structureInk(listOf(
      letter("left1", 0.0), letter("left2", 30.0, time = 10.0),
      letter("right1", 150.0, time = 20.0), letter("right2", 180.0, time = 30.0),
      letter("left3", 0.0, 40.0, 100.0), letter("left4", 30.0, 40.0, 110.0),
      letter("right3", 150.0, 40.0, 120.0), letter("right4", 180.0, 40.0, 130.0),
    ))
    val contexts = mutableMapOf<String, String>()
    val result = recognizeStructuredInk(layout) { strokes, context ->
      val id = strokes.first().id
      contexts[id] = context
      listOf(id)
    }
    @Suppress("UNCHECKED_CAST") val words = result["words"] as List<Map<String, Any?>>
    val byText = words.associateBy { it["text"] }
    assertEquals(2, words.count { it["prev"] == null })
    assertEquals(2, words.count { it["next"] == null })
    for (prefix in listOf("left", "right")) {
      for (i in 1..3) {
        assertEquals(byText["$prefix${i + 1}"]!!["id"], byText["$prefix$i"]!!["next"])
        assertEquals(byText["$prefix$i"]!!["id"], byText["$prefix${i + 1}"]!!["prev"])
      }
      assertEquals("", contexts["${prefix}1"])
      assertEquals("${prefix}1 ${prefix}2 ", contexts["${prefix}3"])
    }
  }

  @Test fun `staggered text blocks retain independent continuation frontiers at any scale`() {
    val ink = listOf(
      letter("left1", 0.0), letter("left2", 30.0, time = 10.0),
      letter("right1", 150.0, 25.0, 20.0), letter("right2", 180.0, 25.0, 30.0),
      letter("left3", 0.0, 40.0, 100.0), letter("left4", 30.0, 40.0, 110.0),
      letter("right3", 150.0, 65.0, 120.0), letter("right4", 180.0, 65.0, 130.0),
    )
    for (scale in listOf(0.5, 1.0, 3.0)) {
      val layout = structureInk(ink.map { stroke ->
        stroke.copy(points = stroke.points.map { it.copy(x = it.x * scale - 200, y = it.y * scale - 100) })
      })
      val words = layout.words.associateBy { it.strokes.first().id }
      assertSame(words["left2"], words["left3"]!!.previous)
      assertSame(words["right2"], words["right3"]!!.previous)
      assertEquals(2, layout.words.count { it.previous == null })
    }
  }

  @Test fun `a late annotation above a row does not become its predecessor`() {
    val layout = structureInk(listOf(letter("a", 0.0, 40.0), letter("b", 30.0, 40.0, 10.0),
      letter("note1", 0.0, 0.0, 100.0), letter("note2", 30.0, 0.0, 110.0)))
    assertNull(layout.words.first { it.strokes.first().id == "a" }.previous)
  }

  @Test fun `word identifiers survive unrelated ink and coordinates may be negative`() {
    val first = structureInk(listOf(letter("original", -100.0, -50.0))).words.single().id
    val updated = structureInk(listOf(letter("new", -300.0, -100.0), letter("original", -100.0, -50.0)))
    assertEquals(first, updated.words.single { it.strokes.first().id == "original" }.id)
  }

  @Test fun `closed nodes own labels and connectors do not become words`() {
    val nodes = listOf(
      trace("left", -10.0 to -10.0, 60.0 to -10.0, 60.0 to 60.0, -10.0 to 60.0, -10.0 to -10.0),
      trace("right", 160.0 to -10.0, 230.0 to -10.0, 230.0 to 60.0, 160.0 to 60.0, 160.0 to -10.0),
      trace("edge", 60.0 to 25.0, 160.0 to 25.0),
    )
    val layout = structureInk(nodes + listOf(letter("a", 0.0), letter("b", 10.0), letter("c", 170.0), letter("d", 180.0)))
    assertEquals(2, layout.regions.size)
    assertEquals(listOf("shape:left", "shape:right"), layout.words.map { it.regionId })
    assertTrue(layout.words.all { it.previous == null })
    assertEquals(mapOf("from" to "shape:left", "to" to "shape:right", "strokeId" to "edge"), layout.connections.single())
  }

  @Test fun `intersecting rules form separate table cells`() {
    val grid = listOf(
      trace("top", -10.0 to -10.0, 190.0 to -10.0), trace("bottom", -10.0 to 70.0, 190.0 to 70.0),
      trace("left", -10.0 to -10.0, -10.0 to 70.0), trace("middle", 90.0 to -10.0, 90.0 to 70.0),
      trace("right", 190.0 to -10.0, 190.0 to 70.0),
    )
    val layout = structureInk(grid + listOf(letter("a", 0.0), letter("b", 10.0), letter("c", 100.0), letter("d", 110.0)))
    assertEquals(2, layout.regions.count { it.kind == "cell" })
    assertNotEquals(layout.words[0].regionId, layout.words[1].regionId)
    assertTrue(layout.words.all { it.previous == null })
    assertEquals(5, layout.drawingStrokeIds.size)
  }

  @Test fun `parallel underlines alone are not table cells`() {
    val layout = structureInk(listOf(letter("a", 0.0), letter("b", 10.0), letter("c", 20.0),
      trace("top", 0.0 to 40.0, 100.0 to 40.0), trace("bottom", 0.0 to 80.0, 100.0 to 80.0)))
    assertTrue(layout.regions.isEmpty())
  }

  @Test fun `cross-out suggests a replacement without deleting original ink`() {
    val scribble = trace("scribble", 0.0 to 5.0, 30.0 to 7.0, 0.0 to 10.0, 30.0 to 12.0,
      0.0 to 15.0, 30.0 to 17.0, time = 100.0)
    val layout = structureInk(listOf(letter("old1", 2.0), letter("old2", 12.0), scribble,
      letter("new1", 2.0, -30.0, 200.0), letter("new2", 12.0, -30.0, 210.0)))
    assertEquals(2, layout.words.size)
    assertTrue(layout.words.flatMap { it.strokes }.any { it.id == "old1" })
    assertTrue(layout.words.flatMap { it.strokes }.any { it.id == "scribble" })
    assertEquals(listOf("word:old1"), layout.corrections.single()["targetGroupIds"])
    assertEquals("word:new1", layout.corrections.single()["replacementGroupId"])
  }

  @Test fun `recognition yields reciprocal links punctuation and bounded context`() = runBlocking {
    val layout = structureInk(listOf(letter("a", 0.0), letter("b", 25.0), letter("c", 100.0)))
    val contexts = mutableListOf<String>()
    val result = recognizeStructuredInk(layout) { strokes, context ->
      contexts += context
      listOf(when (strokes.first().id) { "a" -> "Hello"; "b" -> " World!"; else -> "Wait," })
    }
    @Suppress("UNCHECKED_CAST") val words = result["words"] as List<Map<String, Any?>>
    assertEquals(listOf("", "Hello ", ""), contexts)
    assertEquals("World!", words[1]["text"])
    assertEquals(words[1]["id"], words[0]["next"])
    assertEquals(words[0]["id"], words[1]["prev"])
    assertNull(words[1]["next"])
    assertNull(words[2]["prev"])
  }

  @Test fun `unread groups break links and multiword results expose shared boundaries`() = runBlocking {
    val layout = structureInk(listOf(letter("a", 0.0), letter("b", 25.0), letter("c", 50.0)))
    val contexts = mutableListOf<String>()
    val result = recognizeStructuredInk(layout) { strokes, context ->
      contexts += context
      when (strokes.first().id) { "a" -> listOf("Hello world!"); "b" -> emptyList(); else -> listOf("Again") }
    }
    @Suppress("UNCHECKED_CAST") val words = result["words"] as List<Map<String, Any?>>
    assertEquals(4, words.size)
    assertEquals(true, words[0]["sharedInk"])
    assertEquals(words[1]["id"], words[0]["next"])
    assertNull(words[1]["next"])
    assertNull(words[2]["text"])
    assertNull(words[2]["prev"])
    assertNull(words[3]["prev"])
    assertEquals("", contexts.last())
  }

  @Test fun `precontext never exceeds twenty characters`() = runBlocking {
    val layout = structureInk(listOf(letter("a", 0.0), letter("b", 25.0)))
    val contexts = mutableListOf<String>()
    recognizeStructuredInk(layout) { _, context -> contexts += context; listOf("abcdefghijklmnopqrstuvwxyz") }
    assertEquals(listOf("", "hijklmnopqrstuvwxyz "), contexts)
  }

  @Test fun `recognition combines fragments into row runs without crossing columns or rows`() = runBlocking {
    val layout = recognitionRuns(structureInk(listOf(
      letter("left1", 0.0), letter("left2", 30.0, time = 10.0),
      letter("right1", 150.0, time = 20.0), letter("right2", 180.0, time = 30.0),
      letter("left3", 0.0, 40.0, 100.0), letter("left4", 30.0, 40.0, 110.0),
      letter("right3", 150.0, 40.0, 120.0), letter("right4", 180.0, 40.0, 130.0),
    )))
    val calls = mutableListOf<List<String>>()
    val contexts = mutableListOf<String>()
    val result = recognizeStructuredInk(layout) { strokes, context ->
      calls += strokes.map { it.id }
      contexts += context
      listOf(strokes.joinToString(" ") { it.id })
    }
    assertEquals(listOf(listOf("left1", "left2"), listOf("right1", "right2"),
      listOf("left3", "left4"), listOf("right3", "right4")), calls)
    assertEquals(listOf("", "", "left1 left2 ", "right1 right2 "), contexts)
    @Suppress("UNCHECKED_CAST") val words = result["words"] as List<Map<String, Any?>>
    assertEquals(8, words.size)
    assertEquals(2, words.count { it["prev"] == null })
    assertEquals(2, words.count { it["next"] == null })
    assertTrue(words.all { it["sharedInk"] == true })
    val byId = words.associateBy { it["id"] }
    words.forEach { word ->
      word["next"]?.let { assertEquals(word["id"], byId[it]!!["prev"]) }
    }
  }

  @Test fun `recognition runs preserve drawing order and do not mutate layout groups`() {
    val layout = structureInk(listOf(letter("right", 30.0), letter("left", 0.0, time = 100.0)))
    val runs = recognitionRuns(layout)
    assertEquals(2, layout.words.size)
    assertEquals(listOf("right", "left"), runs.words.single().strokes.map { it.id })
    assertTrue(layout.words.all { it.strokes.size == 1 })
  }

  @Test fun `unconfirmed tall straight strokes are retained for recognition`() {
    val small = (0..7).map { letter("small$it", it * 10.0) }
    val stem = trace("stem", 200.0 to 0.0, 200.0 to 80.0, time = 100.0)
    val layout = structureInk(small + stem)
    assertFalse(layout.drawingStrokeIds.contains("stem"))
    assertTrue(layout.words.flatMap { it.strokes }.any { it.id == "stem" })
  }

  @Test fun `correction references resolve after groups merge into recognition runs`() {
    val layout = structureInk(listOf(letter("a", 0.0), letter("b", 30.0, time = 10.0),
      letter("replacement", 0.0, -40.0, 100.0)))
    val annotated = layout.copy(corrections = listOf(mapOf(
      "strokeId" to "mark", "targetGroupIds" to listOf("word:a", "word:b"),
      "replacementGroupId" to "word:replacement",
    )))
    val runs = recognitionRuns(annotated)
    val correction = runs.corrections.single()
    assertEquals(listOf("word:a"), correction["targetGroupIds"])
    assertEquals("word:replacement", correction["replacementGroupId"])
    assertTrue(runs.words.any { it.id == correction["replacementGroupId"] })
  }
}
