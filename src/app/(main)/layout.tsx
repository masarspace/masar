
"use client";

import Link from "next/link";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  SidebarSeparator,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
} from "@/components/ui/sidebar";
import { Icons } from "@/components/icons";
import {
  LayoutDashboard,
  Package,
  GlassWater,
  ShoppingCart,
  Tags,
  Truck,
  ClipboardList,
} from "lucide-react";
import { usePathname } from "next/navigation";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <SidebarProvider>
      <div className="flex min-h-screen">
        <Sidebar>
          <SidebarContent>
            <SidebarHeader>
              <div className="flex items-center gap-2">
                <Icons.Logo className="w-6 h-6 text-primary" />
                <span className="text-lg font-semibold">MasarBuffetTrack</span>
              </div>
            </SidebarHeader>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  href="/"
                  isActive={pathname === "/"}
                  tooltip="Dashboard"
                >
                  <Link href="/">
                    <LayoutDashboard />
                    <span>Dashboard</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  href="/orders"
                  isActive={pathname.startsWith("/orders")}
                  tooltip="POS Orders"
                >
                  <Link href="/orders">
                    <ShoppingCart />
                    <span>POS Orders</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarSeparator />

              <SidebarGroup>
                <SidebarGroupLabel>Inventory</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                     <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        href="/materials"
                        isActive={pathname.startsWith("/materials")}
                        tooltip="Materials"
                      >
                        <Link href="/materials">
                          <Package />
                          <span>Materials</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        href="/drinks"
                        isActive={pathname.startsWith("/drinks")}
                        tooltip="Recipes"
                      >
                        <Link href="/drinks">
                          <GlassWater />
                          <span>Recipes</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
              
              <SidebarSeparator />

              <SidebarGroup>
                <SidebarGroupLabel>Purchasing</SidebarGroupLabel>
                 <SidebarGroupContent>
                    <SidebarMenu>
                       <SidebarMenuItem>
                        <SidebarMenuButton
                          asChild
                          href="/purchase-orders"
                          isActive={pathname.startsWith("/purchase-orders")}
                          tooltip="New Purchase"
                        >
                          <Link href="/purchase-orders">
                            <ClipboardList />
                            <span>New Purchase</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                      <SidebarMenuItem>
                        <SidebarMenuButton
                          asChild
                          href="/purchase-tracking"
                          isActive={pathname.startsWith("/purchase-tracking")}
                          tooltip="Purchase Tracking"
                        >
                          <Link href="/purchase-tracking">
                            <Truck />
                            <span>Purchase Tracking</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                      <SidebarMenuItem>
                        <SidebarMenuButton
                          asChild
                          href="/categories"
                          isActive={pathname.startsWith("/categories")}
                          tooltip="Categories"
                        >
                          <Link href="/categories">
                            <Tags />
                            <span>Categories</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    </SidebarMenu>
                 </SidebarGroupContent>
              </SidebarGroup>
            </SidebarMenu>
          </SidebarContent>
        </Sidebar>
        <SidebarInset>
          <main className="flex-1">{children}</main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
