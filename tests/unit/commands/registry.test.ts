import { describe, it, expect } from "vitest";
import { PLUGIN_COMMANDS } from "../../../src/commands/registry";

describe("PLUGIN_COMMANDS registry", () => {
  it("should map /help to a handler", () => {
    expect(PLUGIN_COMMANDS["/help"]).toBeTypeOf("function");
  });

  it("should map /? as alias for /help", () => {
    expect(PLUGIN_COMMANDS["/?"])
      .toBe(PLUGIN_COMMANDS["/help"]);
  });

  it("should map /about to a handler", () => {
    expect(PLUGIN_COMMANDS["/about"]).toBeTypeOf("function");
  });

  it("should map /relay to a handler", () => {
    expect(PLUGIN_COMMANDS["/relay"]).toBeTypeOf("function");
  });

  it("should map /session to a handler", () => {
    expect(PLUGIN_COMMANDS["/session"]).toBeTypeOf("function");
  });

  it("should map /s as alias for /session", () => {
    expect(PLUGIN_COMMANDS["/s"])
      .toBe(PLUGIN_COMMANDS["/session"]);
  });

  it("should map /card to a handler", () => {
    expect(PLUGIN_COMMANDS["/card"]).toBeTypeOf("function");
  });

  it("should have exactly 7 entries", () => {
    expect(Object.keys(PLUGIN_COMMANDS)).toHaveLength(7);
  });

  it("should not contain unknown commands", () => {
    expect(PLUGIN_COMMANDS["/unknown"]).toBeUndefined();
  });
});
