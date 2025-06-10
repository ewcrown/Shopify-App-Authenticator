import { json } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import prisma from "../db.server";
import { useState, useMemo, useEffect } from "react";

// Loader: fetch all products
export async function loader() {
  const products = await prisma.product.findMany();
  return json({ products });
}

// Action: delete a single product
export async function action({ request }) {
  const formData = await request.formData();
  const productId = formData.get("productId");

  if (productId) {
    try {
      await prisma.product.delete({
        where: { id: productId },
      });
      return json({ success: true, productId });
    } catch (error) {
      return json({ success: false, error: error.message }, { status: 500 });
    }
  }

  return json({ success: false, error: "Missing productId" }, { status: 400 });
}

export default function ProductsPage() {
  const { products } = useLoaderData();
  const fetcher = useFetcher();

  const [sort, setSort] = useState("asc");
  const [activeTab, setActiveTab] = useState("success");
  const [selectedTag, setSelectedTag] = useState("all");
  const [filteredState, setFilteredState] = useState([]);

  // Extract unique tags
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

  // Filter by tab (success or failed)
  const filteredByTab = useMemo(() => {
    return (activeTab === "success"
      ? sortedProducts.filter((p) => !p.error_handle)
      : sortedProducts.filter((p) => Boolean(p.error_handle))
    );
  }, [sortedProducts, activeTab]);

  // Filter by tag
  const filtered = useMemo(() => {
    return filteredByTab.filter((p) => {
      if (selectedTag === "all") return true;
      return p.tags?.split(",").map((t) => t.trim()).includes(selectedTag);
    });
  }, [filteredByTab, selectedTag]);

  // Keep filteredState in sync with logic
  useEffect(() => {
    setFilteredState(filtered);
  }, [filtered]);

  // Handle deletion client-side
  const handleDelete = (id) => {
    setFilteredState((prev) => prev.filter((item) => item.id !== id));
  };

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
          min-width: 700px;
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
        .delete-button {
          background: none;
          border: none;
          color: red;
          cursor: pointer;
          font-size: 13px;
        }
      `}</style>

      <main className="product-page">
        <h1 className="product-title">Products</h1>

        {/* Sort Dropdown */}
        <select className="sort-select" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="asc">Sort by A–Z</option>
          <option value="latest">Sort by Latest</option>
        </select>

        {/* Tag Filter Dropdown */}
        <select className="sort-select" value={selectedTag} onChange={(e) => setSelectedTag(e.target.value)}>
          <option value="all">All Tags</option>
          {allTags.map((tag) => (
            <option key={tag} value={tag}>{tag}</option>
          ))}
        </select>

        {/* Tabs */}
        <nav className="tabs">
          <button className={`tab${activeTab === "success" ? " active" : ""}`} onClick={() => setActiveTab("success")}>
            Active Products ({sortedProducts.filter((p) => !p.error_handle).length})
          </button>
          <button className={`tab${activeTab === "failed" ? " active" : ""}`} onClick={() => setActiveTab("failed")}>
            Failed Products ({sortedProducts.filter((p) => Boolean(p.error_handle)).length})
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
                <th>Remove</th>
              </tr>
            </thead>
            <tbody>
              {filteredState.map((p) => (
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
                  <td>
                    <fetcher.Form method="post">
                      <input type="hidden" name="productId" value={p.id} />
                      <button
                        type="submit"
                        className="delete-button"
                        onClick={(e) => {
                          e.preventDefault();
                          if (window.confirm("Are you sure you want to delete this product?")) {
                            fetcher.submit(
                              { productId: p.id },
                              { method: "post" }
                            );
                            handleDelete(p.id);
                          }
                        }}
                      >
                        Remove
                      </button>
                    </fetcher.Form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}