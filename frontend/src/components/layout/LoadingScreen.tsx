import { motion } from "framer-motion";

export function LoadingScreen() {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-white">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col items-center gap-4"
      >
        <div className="text-4xl font-bold text-garnish-600">garnish</div>
        <motion.div
          className="h-1 w-16 rounded-full bg-garnish-300"
          animate={{ scaleX: [0.3, 1, 0.3] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          style={{ originX: 0.5 }}
        />
      </motion.div>
    </div>
  );
}
