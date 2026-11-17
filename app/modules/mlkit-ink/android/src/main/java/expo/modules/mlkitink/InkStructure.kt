package expo.modules.mlkitink

import kotlin.math.abs
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min

internal data class InkSample(val x: Double, val y: Double, val t: Double)

internal data class InkBox(val left: Double, val top: Double, val right: Double, val bottom: Double) {
  val width get() = right - left
  val height get() = bottom - top
  val centerY get() = (top + bottom) / 2
  fun contains(x: Double, y: Double) = x in left..right && y in top..bottom
  fun distance(x: Double, y: Double) = hypot(max(0.0, max(left - x, x - right)), max(0.0, max(top - y, y - bottom)))
  fun union(other: InkBox) = InkBox(min(left, other.left), min(top, other.top), max(right, other.right), max(bottom, other.bottom))
  fun payload() = mapOf("x" to left, "y" to top, "width" to width, "height" to height)
}

internal data class InkTrace(val id: String, val points: List<InkSample>) {
  val box = InkBox(points.minOf { it.x }, points.minOf { it.y }, points.maxOf { it.x }, points.maxOf { it.y })
  val length = points.zipWithNext().sumOf { (a, b) -> hypot(b.x - a.x, b.y - a.y) }
  val start get() = points.first()
  val end get() = points.last()
  val span get() = hypot(end.x - start.x, end.y - start.y)

  // Clip each pen segment to the box, including sparse strokes with no sampled point inside it.
  fun intersects(area: InkBox): Boolean = points.any { area.contains(it.x, it.y) } || points.zipWithNext().any { (a, b) ->
    var enter = 0.0
    var leave = 1.0
    for ((start, end, low, high) in listOf(
      listOf(a.x, b.x, area.left, area.right), listOf(a.y, b.y, area.top, area.bottom),
    )) {
      if (start == end) {
        if (start !in low..high) return@any false
      } else {
        val first = (low - start) / (end - start)
        val last = (high - start) / (end - start)
        enter = max(enter, min(first, last))
        leave = min(leave, max(first, last))
        if (enter > leave) return@any false
      }
    }
    true
  }
}

internal data class InkRegion(val id: String, val kind: String, val box: InkBox, val strokeIds: List<String>)

internal class WordInk(val strokes: MutableList<InkTrace>, val regionId: String?) {
  val box get() = strokes.map { it.box }.reduce(InkBox::union)
  val id get() = "word:${strokes.minBy { it.start.t }.id}"
  var previous: WordInk? = null
}

internal data class InkLayout(
  val words: List<WordInk>,
  val regions: List<InkRegion>,
  val connections: List<Map<String, String>>,
  val corrections: List<Map<String, Any?>>,
  val drawingStrokeIds: List<String>,
)

/** Conservative geometry for freehand English/Latin-style notes. Uncertain regions stay separate. */
internal fun structureInk(strokes: List<InkTrace>): InkLayout {
  if (strokes.isEmpty()) return InkLayout(emptyList(), emptyList(), emptyList(), emptyList(), emptyList())
  val heights = strokes.map { it.box.height }.filter { it > 1 }.sorted()
  val textHeight = max(heights.getOrElse(heights.size / 2) { 20.0 }, 1.0)
  val regions = mutableListOf<InkRegion>()
  val drawing = mutableSetOf<String>()
  val rules = mutableListOf<InkTrace>()

  for (stroke in strokes) {
    val b = stroke.box
    val size = max(b.width, b.height)
    val nearbyHeights = strokes.filter { other ->
      other !== stroke && other.span < other.length * 0.9 && other.box.height > textHeight * 0.3 &&
        b.distance((other.box.left + other.box.right) / 2, other.box.centerY) < textHeight * 3
    }.map { it.box.height }.sorted()
    val localHeight = max(textHeight, nearbyHeights.getOrElse(nearbyHeights.size / 2) { textHeight })
    if (size > 3 * localHeight && stroke.span > 0.94 * stroke.length) {
      rules += stroke
      drawing += stroke.id
    } else if (min(b.width, b.height) > 1.8 * localHeight && stroke.span < size * 0.25 && stroke.length > size * 2.4) {
      val onEdge = stroke.points.count {
        min(min(abs(it.x - b.left), abs(it.x - b.right)), min(abs(it.y - b.top), abs(it.y - b.bottom))) < size * 0.08
      }.toDouble() / stroke.points.size
      regions += InkRegion("shape:${stroke.id}", if (onEdge > 0.75) "rectangle" else "loop", b, listOf(stroke.id))
      drawing += stroke.id
    }
  }

  // A ruled cell requires four intersecting boundaries; nearby parallel lines alone are not a table.
  val horizontal = rules.filter { it.box.height < textHeight * 0.4 }.sortedBy { it.box.centerY }
  val vertical = rules.filter { it.box.width < textHeight * 0.4 }.sortedBy { it.box.left }
  for ((top, bottom) in horizontal.zipWithNext()) {
    if (bottom.box.centerY - top.box.centerY < textHeight) continue
    val sides = vertical.filter { side ->
      val x = (side.box.left + side.box.right) / 2
      side.box.top <= top.box.centerY + textHeight * 0.3 && side.box.bottom >= bottom.box.centerY - textHeight * 0.3 &&
        x >= max(top.box.left, bottom.box.left) - textHeight * 0.3 && x <= min(top.box.right, bottom.box.right) + textHeight * 0.3
    }
    for ((left, right) in sides.zipWithNext()) {
      if (right.box.left - left.box.left < textHeight) continue
      regions += InkRegion("cell:${top.id}:${left.id}", "cell",
        InkBox((left.box.left + left.box.right) / 2, top.box.centerY, (right.box.left + right.box.right) / 2, bottom.box.centerY),
        listOf(top.id, bottom.id, left.id, right.id))
    }
  }

  val shapes = regions.filter { it.kind != "cell" }
  val connections = rules.mapNotNull { rule ->
    val from = shapes.filter { it.box.distance(rule.start.x, rule.start.y) < textHeight }.singleOrNull()
    val to = shapes.filter { it.box.distance(rule.end.x, rule.end.y) < textHeight }.singleOrNull()
    if (from == null || to == null || from == to) null
    else mapOf("from" to from.id, "to" to to.id, "strokeId" to rule.id)
  }

  // A late, dense back-and-forth mark is only a correction suggestion, never an automatic deletion.
  val scribbles = strokes.filter { stroke ->
    val directions = stroke.points.zipWithNext().map { (a, b) -> b.x - a.x }.filter { abs(it) > textHeight * 0.08 }
    val turns = directions.zipWithNext().count { (a, b) -> a * b < 0 }
    stroke.id !in drawing && turns >= 3 && stroke.box.width > textHeight && stroke.box.height < textHeight * 1.5 &&
      stroke.length > 4 * stroke.box.width && strokes.any { earlier ->
        earlier.id != stroke.id && earlier.end.t < stroke.start.t &&
          earlier.intersects(stroke.box)
      }
  }
  val excluded = drawing + scribbles.map { it.id }
  val remaining = strokes.filter { it.id !in excluded }
  val words = mutableListOf<WordInk>()
  val byRegion = remaining.groupBy { stroke ->
    regions.filter { it.box.contains((stroke.box.left + stroke.box.right) / 2, stroke.box.centerY) }
      .minByOrNull { it.box.width * it.box.height }?.id
  }
  for ((regionId, regionStrokes) in byRegion) {
    val rows = mutableListOf<MutableList<InkTrace>>()
    val marks = regionStrokes.filter { it.box.height < textHeight * 0.3 }
    for (stroke in regionStrokes.filter { it !in marks }.sortedBy { it.box.centerY }) {
      val row = rows.filter { row ->
        val band = row.map { it.box }.reduce(InkBox::union)
        val overlap = min(band.bottom, stroke.box.bottom) - max(band.top, stroke.box.top)
        overlap >= min(band.height, stroke.box.height) * 0.45 &&
          abs(band.centerY - stroke.box.centerY) <= max(band.height, stroke.box.height) * 0.6
      }.minByOrNull { row -> abs(row.map { it.box }.reduce(InkBox::union).centerY - stroke.box.centerY) }
      if (row != null) row += stroke
      else rows += mutableListOf(stroke)
    }
    // Dots, accents, and punctuation belong to nearby writing even when drawn much later.
    for (mark in marks) {
      val row = rows.minByOrNull { row -> row.minOf { it.box.distance((mark.box.left + mark.box.right) / 2, mark.box.centerY) } }
      if (row != null && row.minOf { it.box.distance((mark.box.left + mark.box.right) / 2, mark.box.centerY) } < max(textHeight, row.maxOf { it.box.height }) * 0.8) row += mark
      else rows += mutableListOf(mark)
    }
    var previousRow = emptyList<WordInk>()
    var previousBox: InkBox? = null
    for (row in rows.sortedBy { it.minOf { s -> s.box.top } }) {
      val rowBox = row.map { it.box }.reduce(InkBox::union)
      val letterHeights = row.filter { it !in marks }.map { it.box.height }.sorted()
      val letterHeight = letterHeights.getOrElse(letterHeights.size / 2) { textHeight }
      val rowWords = mutableListOf<WordInk>()
      var current: WordInk? = null
      for (stroke in row.sortedBy { it.box.left }) {
        val gap = current?.let { stroke.box.left - it.box.right } ?: Double.POSITIVE_INFINITY
        if (current != null && gap <= letterHeight * 0.6) current.strokes += stroke
        else {
          val next = WordInk(mutableListOf(stroke), regionId)
          // Ascenders and capitals make the local row taller than the median pen stroke.
          if (gap <= max(textHeight, rowBox.height) * 1.8) next.previous = current
          words += next
          rowWords += next
          current = next
        }
      }
      val above = previousBox
      if (above != null && previousRow.isNotEmpty()) {
        val height = max(above.height, rowBox.height)
        val gap = rowBox.top - above.bottom
        val overlap = min(above.right, rowBox.right) - max(above.left, rowBox.left)
        val continuousRows = previousRow.drop(1).all { it.previous != null } && rowWords.drop(1).all { it.previous != null }
        val writtenAfter = row.minOf { it.start.t } > previousRow.flatMap { it.strokes }.minOf { it.start.t }
        // Wrap only aligned, nearby, unambiguous text runs; columns and late insertions stay separate.
        if (continuousRows && writtenAfter && gap > 0 && gap <= height * 1.25 &&
          abs(rowBox.left - above.left) <= height * 0.8 && overlap >= min(above.width, rowBox.width) * 0.6) {
          rowWords.first().previous = previousRow.last()
        }
      }
      previousRow = rowWords
      previousBox = rowBox
    }
  }
  words.forEach { it.strokes.sortBy { s -> s.start.t } }
  val corrections = scribbles.map { scribble ->
    val targets = words.filter { word -> word.strokes.any { s ->
      s.end.t < scribble.start.t && s.intersects(scribble.box)
    } }
    val target = targets.singleOrNull()
    val replacement = target?.let { old -> words.filter { candidate ->
      candidate !== old && candidate.regionId == old.regionId && candidate.strokes.all { it.start.t > scribble.end.t } &&
        candidate.box.bottom <= old.box.centerY && old.box.top - candidate.box.bottom < textHeight &&
        min(candidate.box.right, old.box.right) > max(candidate.box.left, old.box.left)
    }.singleOrNull() }
    mapOf<String, Any?>("strokeId" to scribble.id, "targetGroupIds" to targets.map { it.id }, "replacementGroupId" to replacement?.id)
  }
  return InkLayout(words, regions, connections, corrections, drawing.toList())
}

/** Keep stroke-to-word uncertainty explicit when ML Kit finds multiple words in one geometric group. */
internal suspend fun recognizeStructuredInk(
  layout: InkLayout,
  recognize: suspend (List<InkTrace>, String) -> List<String>,
): Map<String, Any?> {
  val output = mutableListOf<MutableMap<String, Any?>>()
  val tailByGroup = mutableMapOf<WordInk, MutableMap<String, Any?>>()
  val contextByGroup = mutableMapOf<WordInk, String>()
  for (group in layout.words) {
    var previous = tailByGroup[group.previous]?.takeIf { it["text"] != null }
    var context = if (previous == null) "" else contextByGroup[group.previous].orEmpty()
    val candidates = recognize(group.strokes, context.takeLast(20)).map { it.trim() }.filter { it.isNotEmpty() }
    val tokens = candidates.firstOrNull()?.split(Regex("\\s+")) ?: listOf(null)
    for ((index, token) in tokens.withIndex()) {
      val id = "${group.id}:${index + 1}"
      val word = mutableMapOf<String, Any?>(
        "id" to id, "groupId" to group.id, "text" to token,
        "prev" to if (token == null) null else previous?.get("id"), "next" to null,
        "regionId" to group.regionId, "strokeIds" to group.strokes.map { it.id },
        "bounds" to group.box.payload(), "sharedInk" to (tokens.size > 1), "candidates" to candidates,
      )
      if (token != null) previous?.set("next", id)
      output += word
      previous = word
    }
    tailByGroup[group] = output.last()
    context = if (tokens.first() == null) "" else (context + " " + tokens.joinToString(" ")).trim()
    contextByGroup[group] = context.takeLast(20)
  }
  return mapOf(
    "words" to output,
    "regions" to layout.regions.map { mapOf("id" to it.id, "kind" to it.kind, "bounds" to it.box.payload(), "strokeIds" to it.strokeIds) },
    "connections" to layout.connections, "corrections" to layout.corrections,
    "drawingStrokeIds" to layout.drawingStrokeIds,
  )
}
