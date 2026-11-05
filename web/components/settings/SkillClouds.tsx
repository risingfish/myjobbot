"use client";

import { SKILL_GROUPS, type Skill, type SkillGroup } from "../../../src/db/resumeStore.js";
import { movedSkill } from "../../../src/resumeProfile/profile.js";
import { Setting } from "./SettingParts.js";
import { AddTerm, Tag, TagButton, TagCloud } from "./Tags.js";

const TITLES: Record<SkillGroup, string> = { engineering: "Engineering", people: "People", project: "Project" };

interface SkillsProps {
    skills: Skill[];
    onChange: (skills: Skill[]) => void;
}

/** Renders the profile's skills as one tag cloud per group, each skill with buttons to move it to another group or remove it, and a field to add one. */
export function SkillClouds({ skills, onChange }: SkillsProps) {
    return (
        <>
            {SKILL_GROUPS.map((group) => (
                <Setting key={group} label={TITLES[group]}>
                    <GroupCloud group={group} skills={skills} onChange={onChange} />
                </Setting>
            ))}
        </>
    );
}

/** Renders one group's skills and the field that adds a skill to it. */
function GroupCloud({ group, skills, onChange }: SkillsProps & { group: SkillGroup }) {
    const inGroup = skills.filter((skill) => skill.group === group);
    const add = (typed: string) => {
        if (typed.trim() !== "") onChange([...skills, { name: typed.trim(), group }]);
    };
    return (
        <>
            <TagCloud label={`${TITLES[group]} skills`} count={inGroup.length}>
                {inGroup.map((skill) => (
                    <SkillTag key={skill.name} skill={skill} skills={skills} onChange={onChange} />
                ))}
            </TagCloud>
            <AddTerm label={`${TITLES[group]} skills`} placeholder="Add a skill" onAdd={add} />
        </>
    );
}

/** Renders one skill as a tag, with a button to move it to each other group and one to remove it. */
function SkillTag({ skill, skills, onChange }: SkillsProps & { skill: Skill }) {
    const others = SKILL_GROUPS.filter((other) => other !== skill.group);
    return (
        <Tag text={skill.name} problems={null}>
            {others.map((other) => (
                <TagButton key={other} label={`Move ${skill.name} to ${TITLES[other]}`} symbol={`→${TITLES[other].slice(0, 3)}`} onClick={() => onChange(movedSkill(skills, skill.name, other))} />
            ))}
            <TagButton label={`Remove ${skill.name}`} symbol="×" remove onClick={() => onChange(skills.filter((each) => each !== skill))} />
        </Tag>
    );
}
