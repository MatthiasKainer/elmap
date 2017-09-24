const prototype = (caller, onDone, obj, fields, ...args) => {
    if (fields.indexOf(".") < 0) {
        obj[fields] = onDone(obj[fields]);
        return obj;
    }

    const element = fields.substring(0, fields.indexOf("."));
    obj[element] = obj[element] || {};
    obj[element] = caller(obj[element], fields.substring(fields.indexOf(".") + 1), ...args);
    return obj;
}

export const set = (obj, fields, val) => {
    return prototype(set, (current) => {
        current = val;
        return current;
    }, obj, fields, val);
}

export const stringcat = (obj, fields, val) => {
    return prototype(stringcat, (current) => {
        current = current || "";
        current += val;
        return current;
    }, obj, fields, val);
}

export const push = (obj, fields, val) => {
    return prototype(push, (current) => {
        current = current || [];
        current.push(val);
        return current;
    }, obj, fields, val);
}

export const increment = (obj, fields) => {
    return prototype(increment, (current) => {
        current = current || 0;
        current++;
        return current;
    }, obj, fields);
}

export const sortProps = (obj) => {
    if (!obj) return obj;
    if (typeof obj !== "object") return obj;
    if (Array.isArray(obj)) {
        return obj.map(item => sortProps(item));
    }
    let _ = {};
    Object.keys(obj).sort().forEach(key => {
        _[key] = sortProps(obj[key]);
    });
    return _;
}