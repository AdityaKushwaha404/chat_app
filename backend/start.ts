process.on('uncaughtException', (err: any) => {
  console.error('Uncaught Exception:', err && (err.stack || err));
  process.exit(1);
});

process.on('unhandledRejection', (reason: any) => {
  console.error('Unhandled Rejection:', reason && (reason.stack || reason));
  process.exit(1);
});

(async () => {
  try {
    await import("./index.js");
  } catch (err: any) {
    console.error("Startup error:", err && (err.stack || err));
    process.exit(1);
  }
})();
