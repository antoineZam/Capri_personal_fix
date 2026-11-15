// SPDX-License-Identifier: GPL-3.0-only

export function isSettingsWindowTitle(title, localizedTitles = []) {
  if (typeof title !== 'string' || !title.trim()) return false;
  const normalized = (value) => value.normalize('NFKC').trim().toLowerCase();
  const value = normalized(title);
  return (
    localizedTitles.some((label) => normalized(label) === value) ||
    /^(?:(?:the|your|her|capri(?:['’]s)?)\s+)?settings(?:\s+capri)?$/u.test(value) ||
    /^(?:(?:твои|твоих|свои|своих)\s+)?настро(?:йки|ек)(?:\s+(?:capri|капри))?$/u.test(value)
  );
}

/** The avatar's own movement commands run before desktop tools or inference. */
export function desktopAvatarCommand(text) {
  const command = text
    .normalize('NFKC')
    .trim()
    .replace(/[.!?…]+$/u, '')
    .replace(/^(?:capri|капри)[\s,:!]+/iu, '')
    .replace(/^(?:please\s+|пожалуйста[,\s]+)/iu, '')
    .replace(/(?:,?\s+please|,?\s+пожалуйста)$/iu, '')
    .trim();
  if (
    /^(?:return|go back|come back|teleport back) (?:(?:to|into) (?:your|the) (?:frame|window)|home)$/iu.test(
      command,
    ) ||
    /^(?:вернись|возвращайся|телепортируйся обратно)(?: (?:обратно )?(?:в (?:сво[еёю] )?(?:окно|окошко|рамку)|к себе|домой|на место))?$/iu.test(
      command,
    )
  )
    return { action: 'return' };
  const perch = command.match(
    /^(?:(?:sit|perch) on (?:top of )?(?:the )?(?:(?:active|current) )?window|(?:сядь|присядь|посиди) на (?:(?:край|верх) )?(?:(?:активное|активном|текущее|текущем) )?окн[ое])(?:\s+(.*))?$/iu,
  );
  if (perch) {
    const title = (perch[1] ?? '').replace(/^[«"']|[»"']$/gu, '').slice(0, 160);
    const aliases = [
      [/^(?:гугл )?хрома?$/iu, 'chrome'],
      [/^блокнота?$/iu, 'notepad'],
      [/^дискорда?$/iu, 'discord'],
      [/^проводника?$/iu, 'explorer'],
    ];
    return { action: 'perch', title: aliases.find(([name]) => name.test(title))?.[1] ?? title };
  }
  const named = command.match(/^(?:sit|perch) on (?:top of )?(?:the )?(.+?) window$/iu);
  if (named) return { action: 'perch', title: named[1].slice(0, 160) };
  return null;
}

const defaultLandingSprite = Object.freeze({
  scale: 240,
  anchor: Object.freeze({ x: 0.5, y: 0.93 }),
});

/** The returned point is the sprite anchor; the whole sprite box must clear the companion. */
export function randomAvatarDestination(
  area,
  owner,
  previous,
  random = Math.random,
  sprite = defaultLandingSprite,
  margin = 24,
) {
  const { scale, anchor } = sprite;
  for (let attempt = 0; attempt < 32; attempt++) {
    const point = {
      x: Math.round(area.x + area.width * (0.13 + random() * 0.74)),
      y: Math.round(area.y + area.height * (0.34 + random() * 0.55)),
    };
    const left = point.x - anchor.x * scale;
    const top = point.y - anchor.y * scale;
    const overlaps =
      left < owner.x + owner.width + margin &&
      left + scale > owner.x - margin &&
      top < owner.y + owner.height + margin &&
      top + scale > owner.y - margin;
    if (!overlaps && (!previous || Math.hypot(point.x - previous.x, point.y - previous.y) >= 140))
      return point;
  }
  return null;
}
