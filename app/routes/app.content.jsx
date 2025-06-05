import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import prisma from "../db.server";
import { useState, useMemo } from "react";

export async function loader() {
  const products = await prisma.product.findMany();
  return json({ products });
}

export default function ProductsPage() {
  const { products } = useLoaderData();
  const [sort, setSort] = useState("asc"); // "asc" = A–Z, "latest" = newest first
  const [activeTab, setActiveTab] = useState("success");
  const [selectedTag, setSelectedTag] = useState("all");

  // Unique tag list for filter
  const allTags = useMemo(() => {
    const tagSet = new Set();
    products.forEach((p) => {
      if (p.tags) {
        p.tags.split(",").forEach((tag) => tagSet.add(tag.trim()));
      }
    });
    return Array.from(tagSet).sort();
  }, [products]);

  // Sort products
  const sortedProducts = useMemo(() => {
    const copy = [...products];
    if (sort === "latest") {
      return copy.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
    return copy.sort((a, b) => a.title.localeCompare(b.title));
  }, [products, sort]);

  // Split by status
  const success = sortedProducts.filter((p) => !p.error_handle);
  const failed = sortedProducts.filter((p) => Boolean(p.error_handle));

  // Apply tag filter
  const filtered = (activeTab === "success" ? success : failed).filter((p) => {
    if (selectedTag === "all") return true;
    return p.tags?.split(",").map((t) => t.trim()).includes(selectedTag);
  });

  return (
    <>
      <style>{`
        .product-page { padding: 24px; font-family: ShopifySans, sans-serif; }
        .product-title { font-size: 20px; font-weight: 600; margin-bottom: 16px; color: #212B36; }
        .tabs { display: flex; gap: 8px; margin-bottom: 16px; }
        .tab {
          padding: 8px 16px;
          border-radius: 4px;
          background: #F4F6F8;
          color: #1D1F21;
          border: 1px solid transparent;
          cursor: pointer;
          font-size: 14px;
          transition: background 0.2s, border-color 0.2s, color 0.2s;
        }
        .tab.active {
          background: #C4DFFF;
          color: #0065FF;
          border-color: #0065FF;
        }
        .sort-select {
          margin-bottom: 16px;
          font-size: 14px;
          padding: 8px 12px;
          border: 1px solid #ccc;
          border-radius: 4px;
        }
        .table-wrapper {
          overflow-x: auto;
          border: 1px solid #DFE3E8;
          border-radius: 4px;
        }
        .data-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 14px;
          min-width: 600px;
        }
        .data-table th {
          background: #F4F6F8;
          color: #6B6B6B;
          text-transform: uppercase;
          text-align: left;
          padding: 8px;
          border-bottom: 1px solid #DFE3E8;
        }
        .data-table td {
          padding: 8px;
          color: #212B36;
          border-bottom: 1px solid #E1E3E5;
        }
        .data-table tr:nth-child(even) td {
          background: #FBFDFF;
        }
      `}</style>

      <main className="product-page">
        <h1 className="product-title">Products</h1>

        {/* Sort Dropdown */}
        <select
          className="sort-select"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="asc">Sort by A–Z</option>
          <option value="latest">Sort by Latest</option>
        </select>

        {/* Tag Filter Dropdown */}
        <select
          className="sort-select"
          value={selectedTag}
          onChange={(e) => setSelectedTag(e.target.value)}
        >
          <option value="all">All Tags</option>
          {allTags.map((tag) => (
            <option key={tag} value={tag}>
              {tag}
            </option>
          ))}
        </select>

        {/* Tabs */}
        <nav className="tabs">
          <button
            className={`tab${activeTab === "success" ? " active" : ""}`}
            onClick={() => setActiveTab("success")}
          >
            Active Products ({success.length})
          </button>
          <button
            className={`tab${activeTab === "failed" ? " active" : ""}`}
            onClick={() => setActiveTab("failed")}
          >
            Failed Products ({failed.length})
          </button>
        </nav>

        {/* Product Table */}
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Shopify ID</th>
                <th>Title</th>
                <th>Handle</th>
                <th>Order ID</th>
                <th>Tags</th>
                <th>Error</th>
                <th>Created At</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id}>
                  <td>{p.shopifyId}</td>
                  <td>{p.title}</td>
                  <td>{p.handle}</td>
                  <td>{p.order_id || "-"}</td>
                  <td>{p.tags ? p.tags.split(",").map(tag => tag.trim()).join(", ") : "-"}</td>
                  <td style={{ color: p.error_handle ? "#C43E1C" : "inherit" }}>
                    {p.error_handle || "-"}
                  </td>
                  <td>{new Date(p.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
