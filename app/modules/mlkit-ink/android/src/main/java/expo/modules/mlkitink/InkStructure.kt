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

  // A long straight stroke alone may be a letter stem. Only remove it from text
  // when a complete cell or a connector between identified shapes corroborates it.
  val confirmedRules = regions.filter { it.kind == "cell" }.flatMap { it.strokeIds }.toSet() +
    connections.mapNotNull { it["strokeId"] }
  drawing.removeAll(rules.filter { it.id !in confirmedRules }.map { it.id }.toSet())

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
  // A suspected correction is not an instruction to erase ink from recognition.
  val excluded = drawing
  val remaining = strokes.filter { it.id !in excluded }
  val words = mutableListOf<WordInk>()
  val byRegion = remaining.groupBy { stroke ->
    regions.filter { it.box.contains((stroke.box.left + stroke.box.right) / 2, stroke.box.centerY) }
      .minByOrNull { it.box.width * it.box.height }?.id
  }
  for ((regionId, regionStrokes) in byRegion) {
    // Scale horizontal gaps using nearby, comparable-height writing on each side.
    // This estimate is independent of the page median and the full row bounds.
    val localHeights = regionStrokes.associateWith { stroke ->
      val s = stroke.box
      val heights = regionStrokes.filter { other ->
        val b = other.box
        val gap = max(0.0, max(s.left - b.right, b.left - s.right))
        b.height > 0 && b.height >= s.height * 0.5 && b.height <= s.height * 2 &&
          gap <= 1.8 * min(s.height, b.height) &&
          min(s.bottom, b.bottom) - max(s.top, b.top) >= min(s.height, b.height) * 0.45
      }.map { it.box.height }.sorted()
      max(if (heights.isEmpty()) 1.0 else (heights[(heights.size - 1) / 2] + heights[heights.size / 2]) / 2, 1.0)
    }
    val rows = mutableListOf<MutableList<InkTrace>>()
    val marks = regionStrokes.filter { stroke -> regionStrokes.any { other ->
      val gap = max(0.0, max(stroke.box.left - other.box.right, other.box.left - stroke.box.right))
      stroke !== other && stroke.box.height < other.box.height * 0.3 &&
        gap <= other.box.height * 0.3 &&
        other.box.distance((stroke.box.left + stroke.box.right) / 2, stroke.box.centerY) < other.box.height * 0.8
    } }
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
    // Keep a separate continuation frontier for each horizontal text run. A row can
    // contain several columns; a gap in one must not break wrapping in the others.
    val previousRuns = mutableListOf<List<WordInk>>()
    for (row in rows.sortedBy { it.minOf { s -> s.box.top } }) {
      val rowWords = mutableListOf<WordInk>()
      var current: WordInk? = null
      for (stroke in row.sortedBy { it.box.left }) {
        val gap = current?.let { stroke.box.left - it.box.right } ?: Double.POSITIVE_INFINITY
        val nearest = current?.strokes?.minByOrNull {
          max(0.0, max(stroke.box.left - it.box.right, it.box.left - stroke.box.right))
        }
        // Small attached marks must not shrink the word's spacing scale.
        val body = current?.strokes?.filter { it !in marks }.orEmpty()
        val priorHeight = body.minByOrNull { abs(it.box.right - stroke.box.left) }
          ?.let { localHeights.getValue(it) } ?: nearest?.let { localHeights.getValue(it) }
        val incomingHeight = if (stroke in marks && priorHeight != null) priorHeight else localHeights.getValue(stroke)
        val letterHeight = min(incomingHeight, priorHeight ?: incomingHeight)
        if (current != null && gap <= letterHeight * 0.6) current.strokes += stroke
        else {
          val next = WordInk(mutableListOf(stroke), regionId)
          if (gap <= letterHeight * 1.8) next.previous = current
          words += next
          rowWords += next
          current = next
        }
      }
      val runs = mutableListOf<MutableList<WordInk>>()
      for (word in rowWords) {
        if (word.previous == null) runs += mutableListOf(word)
        else runs.last() += word
      }
      fun bounds(run: List<WordInk>) = run.map { it.box }.reduce(InkBox::union)
      val candidates = runs.map { run ->
        val box = bounds(run)
        previousRuns.filter { previous ->
          val above = bounds(previous)
          val height = max(above.height, box.height)
          val gap = box.top - above.bottom
          val overlap = min(above.right, box.right) - max(above.left, box.left)
          val writtenAfter = run.flatMap { it.strokes }.minOf { it.start.t } >
            previous.flatMap { it.strokes }.minOf { it.start.t }
          writtenAfter && gap > 0 && gap <= height * 1.25 &&
            abs(box.left - above.left) <= height * 0.8 && overlap >= min(above.width, box.width) * 0.6
        }
      }
      for ((index, run) in runs.withIndex()) {
        val previous = candidates[index].singleOrNull()
        // Never branch a linked list when more than one run could continue it.
        if (previous != null && candidates.count { previous in it } == 1) {
          run.first().previous = previous.last()
        }
      }
      // An intervening run replaces the frontier in its own column, even if it
      // could not be linked. Unrelated, vertically staggered columns keep theirs.
      previousRuns.removeAll { previous ->
        val above = bounds(previous)
        runs.any { run ->
          val box = bounds(run)
          min(above.right, box.right) >= max(above.left, box.left)
        }
      }
      previousRuns.addAll(runs)
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

/** Recognize complete horizontal runs, rather than guessing word boundaries before ML Kit.
 * Geometry groups still define links, but tokens from a run share unresolved ink bounds.
 */
internal fun recognitionRuns(layout: InkLayout): InkLayout {
  val mapped = mutableMapOf<WordInk, WordInk>()
  val runs = mutableListOf<WordInk>()
  for (group in layout.words) {
    val preceding = group.previous
    val previousRun = mapped[preceding]
    val sameRow = preceding != null &&
      min(preceding.box.bottom, group.box.bottom) - max(preceding.box.top, group.box.top) >
      min(preceding.box.height, group.box.height) * 0.45
    if (previousRun != null && sameRow && preceding?.regionId == group.regionId) {
      previousRun.strokes += group.strokes
      mapped[group] = previousRun
    } else {
      val run = WordInk(group.strokes.toMutableList(), group.regionId)
      run.previous = previousRun
      runs += run
      mapped[group] = run
    }
  }
  runs.forEach { it.strokes.sortBy { stroke -> stroke.start.t } }
  val ids = layout.words.associate { it.id to mapped.getValue(it).id }
  val corrections = layout.corrections.map { correction ->
    val targets = (correction["targetGroupIds"] as? List<*>)?.filterIsInstance<String>().orEmpty()
    correction + mapOf(
      "targetGroupIds" to targets.mapNotNull { ids[it] }.distinct(),
      "replacementGroupId" to ids[correction["replacementGroupId"] as? String],
    )
  }
  return layout.copy(words = runs, corrections = corrections)
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
    val candidates = recognize(group.strokes, (if (context.isEmpty()) "" else "$context ").takeLast(20))
      .map { it.trim() }.filter { it.isNotEmpty() }
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
