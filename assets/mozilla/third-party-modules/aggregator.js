const Aggregator = class {
  constructor() {
    this.data = [];
  }

  push(item) {
    const date = new Date(item.submission_timestamp);
    const duration = item.load_duration_ms || 0;

    const fullThreadName =
      item.process_type
      ? item.process_type + '.' + item.thread_name
      : item.thread_name;

    let data = {
      index: this.data.length,
      build_id: item.build_id,
      submission: date.toISOString().slice(0, 10),
      client_id: item.client_id,
      osver: item.os_version,
      ffver: item.platform_version,
      module: item.module_name,
      modver: item.file_version,
      thread: fullThreadName,
    };

    if (typeof item.stack === 'string') {
      const json = JSON.parse(item.stack);
      if (json !== null) {
        data.parsed_stack = json;
        data.stack_disp = `[${json.length} frames]`;
      }
    }
    if (typeof item.memory_map === 'string') {
      const json = JSON.parse(item.memory_map);
      if (json !== null) {
        data.parsed_modules = json;
      }
    }

    this.data.push(data);
  }

  mainTable() {
    return this.data;
  }

  static escapeHtml(unsafe) {
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
  }

  static removePdbExt(path) {
    return path.endsWith('.pdb') ? path.substring(0, path.length - 4) : path;
  }

  getCallstackOffline(index) {
    const br = '<br />';
    const frames = this.data[index].parsed_stack;
    const modules = this.data[index].parsed_modules;
    if (!(frames && modules)) {
      return `No callstack${br}`;
    }
    let stackstr = '';
    for (const [index, frame] of frames.entries()) {
      stackstr += index.toString().padStart(2, '0');
      if (frame.f0_ >= 0) {
        let module = UntrustedModule.removePdbExt(modules[frame.f0_].f0_);
        module += `@${modules[frame.f0_].f1_}`;
        stackstr += ` ${module}+${frame.f1_.toString(16)}${br}`;
      }
      else if (frame.f1_ == 18446744073709552000) {
        stackstr += ` (No module address)${br}`;
      }
      else {
        stackstr += ` ${frame.f1_.toString(16)}${br}`;
      }
    }
    return stackstr;
  }

  getSymbolicateRequest(index) {
    const br = '<br />';

    const frames = this.data[index].parsed_stack;
    const modules = this.data[index].parsed_modules;
    if (!(frames && modules)) {
      return `No callstack${br}`;
    }

    let mm = [];
    modules.forEach(module => mm.push([
      module.f0_,
      // API does not accept an emnpty breakpad id.
      module.f1_.length == 0 ? 'x' : module.f1_]));
    let stacks = [];
    frames.forEach(frame => stacks.push([
      frame.f0_,
      // Offset can be 0n18446744073709552000, but it's too big for JS to handle.
      Number(frame.f1_).toString(16) == '10000000000000000'
        ? 0xffffffff : frame.f1_]));

    return {memoryMap: mm, stacks: [stacks]};
  }

  showSymbolicatedCallstack(control, index) {
    control.innerHTML = 'loading...';
    const req = this.getSymbolicateRequest(index);

    fetch('https://symbols.mozilla.org/symbolicate/v5',
          {method: 'post', body: JSON.stringify(req)})
    .then(res => res.json())
    .then(data => {
      if (!data) {
        control.innerHTML = 'Invalid data!';
        return;
      }
      if (data.error) {
        control.innerHTML = data.error;
        return;
      }

      const br = '<br />';
      const frames = data.results[0].stacks[0];
      let stackstr = '';
      frames.forEach(
        frame => {
          stackstr += `${frame.frame} `;
          stackstr += Aggregator.escapeHtml(
              Aggregator.removePdbExt(frame.module));
          if ('function' in frame)
            stackstr += Aggregator.escapeHtml(
              `!${frame.function}+${frame.function_offset}`);
          else
            stackstr += Aggregator.escapeHtml(
              `+${frame.module_offset}`);
          stackstr += br;
        }
      );
      control.innerHTML = stackstr;
    })
    .catch(error => {
      control.innerHTML = error;
    });
  }
};