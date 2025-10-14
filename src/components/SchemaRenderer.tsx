import {useState} from 'react';
import {ChevronDown, ChevronRight} from 'lucide-react';

interface SchemaRendererProps {
  schema: any;
  name?: string;
  required?: boolean;
  level?: number;
}

const TypeBadge = ({ type, format }: { type: string; format?: string }) => {
  const typeColors: Record<string, string> = {
    string: 'bg-green-100 text-green-700',
    number: 'bg-blue-100 text-blue-700',
    integer: 'bg-blue-100 text-blue-700',
    boolean: 'bg-purple-100 text-purple-700',
    object: 'bg-orange-100 text-orange-700',
    array: 'bg-pink-100 text-pink-700',
  };

  return (
    <span className={`text-xs px-2 py-0.5 rounded font-mono ${typeColors[type] || 'bg-gray-100 text-gray-700'}`}>
      {type}
      {format && ` (${format})`}
    </span>
  );
};

const SchemaProperty = ({
  name,
  schema,
  required,
  level = 0
}: {
  name: string;
  schema: any;
  required?: boolean;
  level?: number;
}) => {
  const [isExpanded, setIsExpanded] = useState(level < 2); // Auto-expand first 2 levels
  const hasChildren = schema.type === 'object' && schema.properties;
  const isArray = schema.type === 'array';

  return (
    <div style={{ marginLeft: level > 0 ? '16px' : 0 }}>
      <div className="flex items-start gap-2 py-1.5 group hover:bg-gray-50 px-2 rounded">
        {/* Expand/Collapse Icon */}
        {(hasChildren || isArray) && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="mt-0.5 text-gray-400 hover:text-gray-600"
          >
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        )}
        {!(hasChildren || isArray) && <div className="w-3.5" />}

        {/* Property Name */}
        <code className="font-mono text-sm font-semibold text-gray-900 mt-0.5">
          {name}
        </code>

        {/* Type Badge */}
        <TypeBadge type={schema.type || 'any'} format={schema.format} />

        {/* Array Item Type */}
        {isArray && schema.items && (
          <span className="text-xs text-gray-500">
            of {schema.items.type || 'any'}
            {schema.items.format && ` (${schema.items.format})`}
          </span>
        )}

        {/* Required Badge */}
        {required && (
          <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded font-semibold">
            required
          </span>
        )}

        {/* Description */}
        {schema.description && (
          <span className="text-xs text-gray-600 flex-1">
            {schema.description}
          </span>
        )}
      </div>

      {/* Constraints */}
      {(schema.enum || schema.minimum !== undefined || schema.maximum !== undefined ||
        schema.minLength !== undefined || schema.maxLength !== undefined ||
        schema.pattern || schema.default !== undefined || schema.example !== undefined) && (
        <div className="ml-8 text-xs text-gray-500 space-y-0.5 mt-1">
          {schema.enum && (
            <div className="flex items-center gap-2">
              <span className="text-gray-400">enum:</span>
              <code className="bg-gray-100 px-2 py-0.5 rounded">
                {schema.enum.join(', ')}
              </code>
            </div>
          )}
          {schema.minimum !== undefined && (
            <div>min: {schema.minimum}</div>
          )}
          {schema.maximum !== undefined && (
            <div>max: {schema.maximum}</div>
          )}
          {schema.minLength !== undefined && (
            <div>minLength: {schema.minLength}</div>
          )}
          {schema.maxLength !== undefined && (
            <div>maxLength: {schema.maxLength}</div>
          )}
          {schema.pattern && (
            <div className="flex items-center gap-2">
              <span className="text-gray-400">pattern:</span>
              <code className="bg-gray-100 px-1 rounded">{schema.pattern}</code>
            </div>
          )}
          {schema.default !== undefined && (
            <div className="flex items-center gap-2">
              <span className="text-gray-400">default:</span>
              <code className="bg-gray-100 px-1 rounded">{JSON.stringify(schema.default)}</code>
            </div>
          )}
          {schema.example !== undefined && (
            <div className="flex items-center gap-2">
              <span className="text-gray-400">example:</span>
              <code className="bg-gray-100 px-1 rounded">{JSON.stringify(schema.example)}</code>
            </div>
          )}
        </div>
      )}

      {/* Nested Object Properties */}
      {hasChildren && isExpanded && (
        <div className="ml-2 border-l-2 border-gray-200 pl-2 mt-1">
          {Object.entries(schema.properties).map(([propName, propSchema]: [string, any]) => (
            <SchemaProperty
              key={propName}
              name={propName}
              schema={propSchema}
              required={schema.required?.includes(propName)}
              level={level + 1}
            />
          ))}
        </div>
      )}

      {/* Array Items */}
      {isArray && isExpanded && schema.items && schema.items.type === 'object' && schema.items.properties && (
        <div className="ml-2 border-l-2 border-gray-200 pl-2 mt-1">
          <div className="text-xs text-gray-500 mb-1 font-semibold">Items:</div>
          {Object.entries(schema.items.properties).map(([propName, propSchema]: [string, any]) => (
            <SchemaProperty
              key={propName}
              name={propName}
              schema={propSchema}
              required={schema.items.required?.includes(propName)}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default function SchemaRenderer({ schema, name, required }: SchemaRendererProps) {
  if (!schema) {
    return <div className="text-xs text-gray-400 italic">No schema defined</div>;
  }

  // If schema has properties (object type), render them
  if (schema.type === 'object' && schema.properties) {
    return (
      <div className="space-y-0.5">
        {name && (
          <div className="flex items-center gap-2 mb-2">
            <code className="font-mono text-sm font-semibold text-gray-900">{name}</code>
            <TypeBadge type="object" />
            {required && (
              <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded font-semibold">
                required
              </span>
            )}
          </div>
        )}
        {Object.entries(schema.properties).map(([propName, propSchema]: [string, any]) => (
          <SchemaProperty
            key={propName}
            name={propName}
            schema={propSchema}
            required={schema.required?.includes(propName)}
            level={name ? 1 : 0}
          />
        ))}
      </div>
    );
  }

  // If schema is array, render it
  if (schema.type === 'array') {
    return (
      <div>
        {name && (
          <div className="flex items-center gap-2 mb-2">
            <code className="font-mono text-sm font-semibold text-gray-900">{name}</code>
            <TypeBadge type="array" />
            {schema.items && (
              <span className="text-xs text-gray-500">
                of {schema.items.type || 'any'}
              </span>
            )}
            {required && (
              <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded font-semibold">
                required
              </span>
            )}
          </div>
        )}
        {schema.items && schema.items.type === 'object' && schema.items.properties && (
          <div className="ml-4 border-l-2 border-gray-200 pl-3">
            <div className="text-xs text-gray-500 mb-1 font-semibold">Items:</div>
            {Object.entries(schema.items.properties).map(([propName, propSchema]: [string, any]) => (
              <SchemaProperty
                key={propName}
                name={propName}
                schema={propSchema}
                required={schema.items.required?.includes(propName)}
                level={1}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Simple type (string, number, boolean, etc.)
  return (
    <div className="flex items-center gap-2">
      {name && (
        <code className="font-mono text-sm font-semibold text-gray-900">{name}</code>
      )}
      <TypeBadge type={schema.type || 'any'} format={schema.format} />
      {required && (
        <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded font-semibold">
          required
        </span>
      )}
      {schema.description && (
        <span className="text-xs text-gray-600">{schema.description}</span>
      )}
    </div>
  );
}
