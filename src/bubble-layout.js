export var BUBBLE_LAYOUT_DEFAULTS = {
  margin: 12,
  gap: 20,
  minGap: 10,
  petPadding: 10,
  jitterX: 24,
  jitterY: 14,
  minWidth: 180,
  maxWidth: 280,
  widthStep: 24,
  gapGrowthFactor: 0.1,
};

export function clamp(value, min, max) {
  if (max < min) return min;
  return Math.max(min, Math.min(max, value));
}

export function expandRect(rect, padding) {
  return {
    left: rect.left - padding,
    top: rect.top - padding,
    right: rect.right + padding,
    bottom: rect.bottom + padding,
  };
}

export function rectOverlapArea(a, b) {
  var overlapWidth = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
  var overlapHeight = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  return overlapWidth * overlapHeight;
}

export function resolveBubbleGap(anchorRect, bubbleHeight, options) {
  options = options || {};
  var minGap = options.minGap == null ? BUBBLE_LAYOUT_DEFAULTS.minGap : options.minGap;
  var maxGap = options.maxGap == null ? BUBBLE_LAYOUT_DEFAULTS.gap : options.maxGap;
  var gapGrowthFactor = options.gapGrowthFactor == null
    ? BUBBLE_LAYOUT_DEFAULTS.gapGrowthFactor
    : options.gapGrowthFactor;
  var heightThreshold = options.heightThreshold == null
    ? anchorRect.height * 0.5
    : options.heightThreshold;
  var heightOffset = Math.max(0, bubbleHeight - heightThreshold);

  return clamp(Math.round(minGap + heightOffset * gapGrowthFactor), minGap, maxGap);
}

export function buildBubbleCandidates(anchorRect, bubbleWidth, bubbleHeight, jitterX, jitterY, gap) {
  var cx = anchorRect.left + anchorRect.width / 2;

  return [
    {
      name: 'top',
      left: cx - bubbleWidth / 2 + jitterX,
      top: anchorRect.top - bubbleHeight - gap + jitterY,
      targetX: cx,
      targetY: anchorRect.top,
      arrowSide: 'bottom',
      bias: 0,
    },
    {
      name: 'top-right',
      left: anchorRect.right - 36 + jitterX,
      top: anchorRect.top - bubbleHeight - gap + jitterY,
      targetX: anchorRect.right - anchorRect.width * 0.24,
      targetY: anchorRect.top,
      arrowSide: 'bottom',
      bias: 2,
    },
    {
      name: 'top-left',
      left: anchorRect.left - bubbleWidth + 36 + jitterX,
      top: anchorRect.top - bubbleHeight - gap + jitterY,
      targetX: anchorRect.left + anchorRect.width * 0.24,
      targetY: anchorRect.top,
      arrowSide: 'bottom',
      bias: 2,
    }
  ];
}

export function resolveBubbleRectWithinBounds(candidate, bubbleWidth, bubbleHeight, boundsRect, margin) {
  var minLeft = boundsRect.left + margin;
  var maxLeft = boundsRect.right - bubbleWidth - margin;
  var minTop = boundsRect.top + margin;
  var maxTop = boundsRect.bottom - bubbleHeight - margin;
  var left = clamp(candidate.left, minLeft, maxLeft);
  var top = clamp(candidate.top, minTop, maxTop);
  return {
    left: left,
    top: top,
    right: left + bubbleWidth,
    bottom: top + bubbleHeight,
  };
}

export function resolveBubbleRect(candidate, bubbleWidth, bubbleHeight, boundsWidth, boundsHeight, margin) {
  return resolveBubbleRectWithinBounds(candidate, bubbleWidth, bubbleHeight, {
    left: 0,
    top: 0,
    right: boundsWidth,
    bottom: boundsHeight,
  }, margin);
}

export function scoreBubblePlacementWithinBounds(candidate, bubbleWidth, bubbleHeight, boundsRect, avoidRect, margin) {
  var bubbleRect = resolveBubbleRectWithinBounds(candidate, bubbleWidth, bubbleHeight, boundsRect, margin);
  var overlapArea = rectOverlapArea(bubbleRect, avoidRect);
  var clampPenalty = Math.abs(bubbleRect.left - candidate.left) + Math.abs(bubbleRect.top - candidate.top);

  return (
    (candidate.bias || 0) +
    clampPenalty * 2 +
    (overlapArea > 0 ? 100000 + overlapArea : 0)
  );
}

export function scoreBubblePlacement(candidate, bubbleWidth, bubbleHeight, boundsWidth, boundsHeight, avoidRect, margin) {
  return scoreBubblePlacementWithinBounds(candidate, bubbleWidth, bubbleHeight, {
    left: 0,
    top: 0,
    right: boundsWidth,
    bottom: boundsHeight,
  }, avoidRect, margin);
}

export function pickBubblePlacementWithinBounds(anchorRect, bubbleWidth, bubbleHeight, boundsRect, options) {
  options = options || {};
  var margin = options.margin || BUBBLE_LAYOUT_DEFAULTS.margin;
  var petPadding = options.petPadding || BUBBLE_LAYOUT_DEFAULTS.petPadding;
  var jitterXRange = options.jitterX || BUBBLE_LAYOUT_DEFAULTS.jitterX;
  var jitterYRange = options.jitterY || BUBBLE_LAYOUT_DEFAULTS.jitterY;
  var random = options.random || Math.random;
  var gap = options.gap;

  if (gap == null) {
    gap = resolveBubbleGap(anchorRect, bubbleHeight, options);
  }

  var jitterX = Math.round((random() - 0.5) * jitterXRange);
  var jitterY = Math.round((random() - 0.5) * jitterYRange);
  var avoidRect = expandRect(anchorRect, petPadding);
  var candidates = buildBubbleCandidates(anchorRect, bubbleWidth, bubbleHeight, jitterX, jitterY, gap);

  candidates.sort(function(a, b) {
    return scoreBubblePlacementWithinBounds(a, bubbleWidth, bubbleHeight, boundsRect, avoidRect, margin) -
      scoreBubblePlacementWithinBounds(b, bubbleWidth, bubbleHeight, boundsRect, avoidRect, margin);
  });

  var bestScore = scoreBubblePlacementWithinBounds(candidates[0], bubbleWidth, bubbleHeight, boundsRect, avoidRect, margin);
  var viable = candidates.filter(function(candidate) {
    return scoreBubblePlacementWithinBounds(candidate, bubbleWidth, bubbleHeight, boundsRect, avoidRect, margin) <= bestScore + 6;
  });
  return viable[Math.floor(random() * viable.length)];
}

export function pickBubblePlacement(anchorRect, bubbleWidth, bubbleHeight, boundsWidth, boundsHeight, options) {
  return pickBubblePlacementWithinBounds(anchorRect, bubbleWidth, bubbleHeight, {
    left: 0,
    top: 0,
    right: boundsWidth,
    bottom: boundsHeight,
  }, options);
}

export function resolveWideBubbleSize(measureAtWidth, options) {
  options = options || {};
  var minWidth = options.minWidth || BUBBLE_LAYOUT_DEFAULTS.minWidth;
  var maxWidth = options.maxWidth || BUBBLE_LAYOUT_DEFAULTS.maxWidth;
  var widthStep = options.widthStep || BUBBLE_LAYOUT_DEFAULTS.widthStep;

  var measured = measureAtWidth(null);
  var targetWidth = Math.max(measured.width, minWidth);

  if (targetWidth !== measured.width) {
    measured = measureAtWidth(targetWidth);
  }

  while (measured.height >= measured.width && targetWidth < maxWidth) {
    targetWidth = Math.min(maxWidth, targetWidth + widthStep);
    measured = measureAtWidth(targetWidth);
  }

  return measured;
}
