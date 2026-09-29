import React from "react";

export type InternalLinkItem = {
  name: string;
  url: string;
  description?: string;
};

export type MovieInternalLinksProps = {
  title?: string;
  directorName?: string | null;
  collectionItems?: InternalLinkItem[];
  directorItems?: InternalLinkItem[];
  similarItems?: InternalLinkItem[];
};

function renderItemList(items: InternalLinkItem[], listName: string, description: string) {
  if (!items || items.length === 0) {
    return null;
  }

  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: listName,
    description,
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "Movie",
        name: item.name,
        url: item.url,
        description: item.description || undefined
      }
    }))
  };
}

export function MovieInternalLinks({
  title,
  directorName,
  collectionItems = [],
  directorItems = [],
  similarItems = []
}: MovieInternalLinksProps) {
  const collectionList = renderItemList(
    collectionItems,
    `${title || "Movie"} watch order`,
    "Chronological watch order for this movie collection or franchise."
  );

  const directorList = renderItemList(
    directorItems,
    `Movies directed by ${directorName || "Director"}`,
    `Ranked filmography of ${directorName || "the director"}.`
  );

  const similarList = renderItemList(
    similarItems,
    `Similar movies to ${title || "this movie"}`,
    "Recommended movies with similar themes, tone, or audience appeal."
  );

  const structuredLists = [collectionList, directorList, similarList].filter(Boolean);

  return (
    <section aria-label="Movie Internal Links" style={{ display: "grid", gap: "1rem" }}>
      {collectionItems.length > 0 && (
        <div>
          <h3>Chronological Watch Order</h3>
          <ul>
            {collectionItems.map((item) => (
              <li key={item.url}>
                <a href={item.url}>{item.name}</a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {directorItems.length > 0 && (
        <div>
          <h3>{`Movies directed by ${directorName || "Director"} ranked`}</h3>
          <ul>
            {directorItems.map((item) => (
              <li key={item.url}>
                <a href={item.url}>{item.name}</a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {similarItems.length > 0 && (
        <div>
          <h3>Similar Movies</h3>
          <ul>
            {similarItems.map((item) => (
              <li key={item.url}>
                <a href={item.url}>{item.name}</a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {structuredLists.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredLists)
          }}
        />
      )}
    </section>
  );
}
