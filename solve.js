// Offsets index the input string in UTF-16 code units, the same units used by slice.
export function run(input) {
  const text = String(input.text);
  const length = text.length;
  const hasHeader = input.header === true;
  const rows = [];
  const errors = [];
  let columns = null;
  let width = -1;
  let cursor = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  let line = 1;

  while (cursor < length) {
    const initial = text.charCodeAt(cursor);
    if (initial === 10 || (initial === 13 && text.charCodeAt(cursor + 1) === 10)) {
      cursor += initial === 10 ? 1 : 2;
      line++;
      continue;
    }

    const startLine = line;
    const row = hasHeader && width < 0 ? null : rows.length;
    const fields = [];
    let quoted;
    let delimiter;
    do {
      const opening = cursor;
      quoted = text.charCodeAt(cursor) === 34;
      let value = '';
      let closed = false;
      let segment = cursor;

      if (quoted) {
        segment = ++cursor;
        const lineAtQuote = line;
        while (cursor < length) {
          const code = text.charCodeAt(cursor);
          if (code === 34) {
            value += text.slice(segment, cursor);
            cursor++;
            if (text.charCodeAt(cursor) !== 34) {
              closed = true;
              break;
            }
            segment = cursor++;
          } else if (code === 13) {
            value += text.slice(segment, cursor) + '\n';
            cursor += text.charCodeAt(cursor + 1) === 10 ? 2 : 1;
            segment = cursor;
            line++;
          } else {
            if (code === 10) line++;
            cursor++;
          }
        }
        if (!closed) {
          errors.push({ code: 'unterminated_quote', line: startLine, row });
          line = lineAtQuote;
          cursor = opening;
          value = '';
        }
        segment = cursor;
      }

      const junkStart = cursor;
      let dropped = 0;
      for (;;) {
        while (cursor < length) {
          delimiter = text.charCodeAt(cursor);
          if (delimiter === 44 || delimiter === 10 || delimiter === 13) break;
          cursor++;
        }
        if (cursor === length) {
          delimiter = -1;
          break;
        }
        if (delimiter !== 13 || text.charCodeAt(cursor + 1) === 10) break;
        value += text.slice(segment, cursor);
        segment = ++cursor;
        dropped++;
        errors.push({ code: 'stray_cr', line: startLine, row });
      }
      if (cursor !== segment) value += text.slice(segment, cursor);
      if (closed && cursor - junkStart > dropped) {
        errors.push({ code: 'quote_junk', line: startLine, row });
      }
      fields.push(value);
      if (delimiter >= 0) {
        cursor += delimiter === 13 ? 2 : 1;
        if (delimiter !== 44) line++;
      }
    } while (delimiter === 44);

    if (fields.length === 1 && fields[0] === '' && !quoted) continue;
    if (width < 0) {
      width = fields.length;
      if (hasHeader) {
        columns = fields;
        continue;
      }
    } else if (fields.length < width) {
      errors.push({ code: 'short_row', line: startLine, row, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: startLine, row, extra: fields.splice(width) });
    }
    rows.push(fields);
  }
  return { columns: hasHeader ? (columns ?? []) : null, rows, errors };
}
