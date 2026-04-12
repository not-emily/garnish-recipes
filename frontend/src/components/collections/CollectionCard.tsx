import { Link } from "react-router";
import { BookOpen, Lock, Users, Share2 } from "lucide-react";
import { motion } from "framer-motion";
import type { CollectionSummary } from "@/types/collection";

interface CollectionCardProps {
  collection: CollectionSummary;
}

export function CollectionCard({ collection }: CollectionCardProps) {
  const initial = collection.name.charAt(0).toUpperCase() || "?";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
    >
      <Link
        to={`/collections/${collection.id}`}
        className="group flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white transition-shadow hover:shadow-md"
      >
        <div className="relative flex aspect-[4/3] items-center justify-center bg-gradient-to-br from-garnish-50 to-garnish-100">
          <span className="text-5xl font-light text-garnish-300">{initial}</span>

          <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-xs font-medium text-gray-700 backdrop-blur-sm">
            {collection.is_shared ? (
              <Share2 className="h-3 w-3" />
            ) : collection.visibility === "private" ? (
              <Lock className="h-3 w-3" />
            ) : (
              <Users className="h-3 w-3" />
            )}
            {collection.is_shared
              ? "Shared"
              : collection.visibility === "private"
                ? "Private"
                : "Household"}
          </div>
        </div>

        <div className="flex flex-1 flex-col p-3">
          <h3 className="line-clamp-2 font-medium text-gray-900 group-hover:text-garnish-700">
            {collection.name}
          </h3>

          {collection.description && (
            <p className="mt-1 line-clamp-1 text-xs text-gray-500">
              {collection.description}
            </p>
          )}

          <div className="mt-auto flex items-center gap-3 pt-2 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <BookOpen className="h-3 w-3" />
              {collection.recipe_count}{" "}
              {collection.recipe_count === 1 ? "recipe" : "recipes"}
            </span>
            {!collection.is_mine && (
              <span className="text-gray-400">by {collection.owner.name}</span>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
