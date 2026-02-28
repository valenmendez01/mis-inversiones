"use client";

import React from "react";
import {
  Navbar as HeroUINavbar,
  NavbarContent,
  NavbarMenu,
  NavbarMenuToggle,
  NavbarBrand,
  NavbarItem,
  NavbarMenuItem,
} from "@heroui/navbar";
import { usePathname } from "next/navigation";
import { Link } from "@heroui/link";
import { link as linkStyles } from "@heroui/theme";
import NextLink from "next/link";
import clsx from "clsx";
import { siteConfig } from "@/config/site";
import { ThemeSwitch } from "@/components/theme-switch";
import { ChartNoAxesColumn } from "lucide-react";
import { Divider } from "@heroui/divider";

export const Navbar = () => {

  const pathname = usePathname();

  return (
    <HeroUINavbar maxWidth="xl" position="sticky">
      <NavbarContent className="basis-1/5 sm:basis-full" justify="start">
        <NavbarBrand as="li" className="gap-3 max-w-fit">
          <NextLink className="flex justify-start items-center gap-1" href="/">
            <ChartNoAxesColumn />
          </NextLink>
        </NavbarBrand>
        <ul className="hidden lg:flex gap-4 justify-start ml-2">
          {siteConfig.navItems.map((item, index, array) => {
            const isActive = pathname === item.href;

            return (
              <React.Fragment key={item.href}>
                <NavbarItem isActive={isActive}>
                  <NextLink
                    data-text={item.label}
                    className={clsx(
                      linkStyles({ color: "foreground" }), 
                      isActive ? "!text-blue-500 font-bold" : "",
                      "flex flex-col items-center after:content-[attr(data-text)] after:font-bold after:h-0 after:invisible after:overflow-hidden"
                    )}
                    href={item.href}
                  >
                    {item.label}
                  </NextLink>
                </NavbarItem>
                
                {index < array.length - 1 && (
                  <Divider orientation="vertical" className="h-5 self-center opacity-50 mx-2" />
                )}
              </React.Fragment>
            );
          })}
        </ul>
      </NavbarContent>

      <NavbarContent
        className="hidden sm:flex basis-1/5 sm:basis-full"
        justify="end"
      >
        <NavbarItem className="hidden sm:flex gap-2">
          <ThemeSwitch />
        </NavbarItem>
        <NavbarItem className="hidden md:flex">
        </NavbarItem>
      </NavbarContent>

      <NavbarContent className="sm:hidden basis-1 pl-4" justify="end">
        <ThemeSwitch />
        <NavbarMenuToggle />
      </NavbarContent>

      <NavbarMenu>
        <div className="mx-4 mt-2 flex flex-col gap-2">
          {siteConfig.navMenuItems.map((item, index) => (
            <NavbarMenuItem key={`${item}-${index}`}>
              <Link
                color={
                  index === 2
                    ? "primary"
                    : index === siteConfig.navMenuItems.length - 1
                      ? "danger"
                      : "foreground"
                }
                href="#"
                size="lg"
              >
                {item.label}
              </Link>
            </NavbarMenuItem>
          ))}
        </div>
      </NavbarMenu>
    </HeroUINavbar>
  );
};
