export function createQueue(concurrency) {
  let active = 0;
  const pending = [];

  const pump = () => {
    while (active < concurrency && pending.length) {
      const job = pending.shift();
      active += 1;
      Promise.resolve()
        .then(job.fn)
        .then(job.resolve, job.reject)
        .finally(() => {
          active -= 1;
          pump();
        });
    }
  };

  return function enqueue(fn) {
    return new Promise((resolve, reject) => {
      pending.push({ fn, resolve, reject });
      pump();
    });
  };
}
