import { GENDERS, QUIZ_FORMS, ROUTING_RULE, routeForm } from "@/lib/spec-test/gender/forms";

describe("routeForm", () => {
  it("routes male to the male_user form with an assumed female attraction target", () => {
    const result = routeForm("male");
    expect(result).toEqual({
      quizForm: "male_user",
      assumedAttractionTarget: "female",
      routingRule: ROUTING_RULE,
    });
  });

  it("routes female to the female_user form with an assumed male attraction target", () => {
    const result = routeForm("female");
    expect(result).toEqual({
      quizForm: "female_user",
      assumedAttractionTarget: "male",
      routingRule: ROUTING_RULE,
    });
  });

  it("is exhaustive over every declared gender", () => {
    for (const gender of GENDERS) {
      expect(() => routeForm(gender)).not.toThrow();
    }
  });

  it("always names the same routing rule - a rule change is a new named constant, not silent drift", () => {
    for (const gender of GENDERS) {
      expect(routeForm(gender).routingRule).toBe("heterosexual_v0_1");
    }
  });

  it("only ever returns a quizForm from the declared set", () => {
    for (const gender of GENDERS) {
      expect(QUIZ_FORMS).toContain(routeForm(gender).quizForm);
    }
  });

  it("is a pure function - same gender always produces the same result", () => {
    expect(routeForm("male")).toEqual(routeForm("male"));
    expect(routeForm("female")).toEqual(routeForm("female"));
  });
});
